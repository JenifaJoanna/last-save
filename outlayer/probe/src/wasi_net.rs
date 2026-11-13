//! WASI P2 HTTP client with first-byte and between-bytes timeouts (wasi-http-client
//! has only a connect timeout, so a server that accepts and then stalls would hang a probe).

use crate::rpc::{HttpResp, Net};
use std::time::{Duration, Instant};
use wasi::http::outgoing_handler;
use wasi::http::types::{Fields, Method, OutgoingBody, OutgoingRequest, RequestOptions, Scheme};
use wasi::io::streams::StreamError;

const STEP_TIMEOUT: Duration = Duration::from_secs(10);
const TOTAL_TIMEOUT: Duration = Duration::from_secs(15);
const MAX_BODY: usize = 2 * 1024 * 1024;

pub struct WasiNet {
    start: Instant,
}

impl WasiNet {
    pub fn new() -> Self {
        WasiNet { start: Instant::now() }
    }
}

impl Default for WasiNet {
    fn default() -> Self {
        Self::new()
    }
}

impl Net for WasiNet {
    fn get(&self, url: &str) -> Result<HttpResp, String> {
        send(Method::Get, url, None)
    }
    fn post_json(&self, url: &str, body: &[u8]) -> Result<HttpResp, String> {
        send(Method::Post, url, Some(body))
    }
    fn sleep_ms(&self, ms: u64) {
        std::thread::sleep(Duration::from_millis(ms));
    }
    fn elapsed_ms(&self) -> u64 {
        self.start.elapsed().as_millis() as u64
    }
}

fn split_url(url: &str) -> Result<(Scheme, &str, String), String> {
    let (scheme, rest) = if let Some(r) = url.strip_prefix("https://") {
        (Scheme::Https, r)
    } else if let Some(r) = url.strip_prefix("http://") {
        (Scheme::Http, r)
    } else {
        return Err("unsupported url scheme".into());
    };
    let (authority, path) = match rest.find(['/', '?']) {
        Some(i) if rest.as_bytes()[i] == b'/' => (&rest[..i], rest[i..].to_string()),
        Some(i) => (&rest[..i], format!("/{}", &rest[i..])),
        None => (rest, "/".to_string()),
    };
    if authority.is_empty() {
        return Err("url has no host".into());
    }
    Ok((scheme, authority, path))
}

fn send(method: Method, url: &str, body: Option<&[u8]>) -> Result<HttpResp, String> {
    let started = Instant::now();
    let (scheme, authority, path) = split_url(url)?;
    let headers = Fields::new();
    if body.is_some() {
        headers
            .set(&"content-type".to_string(), &[b"application/json".to_vec()])
            .map_err(|e| format!("header: {e:?}"))?;
    }
    let req = OutgoingRequest::new(headers);
    req.set_method(&method).map_err(|()| "set method".to_string())?;
    req.set_scheme(Some(&scheme)).map_err(|()| "set scheme".to_string())?;
    req.set_authority(Some(authority)).map_err(|()| "set authority".to_string())?;
    req.set_path_with_query(Some(&path)).map_err(|()| "set path".to_string())?;

    let out_body = req.body().map_err(|_| "request body".to_string())?;
    if let Some(b) = body {
        let stream = out_body.write().map_err(|_| "request body stream".to_string())?;
        stream
            .blocking_write_and_flush(b)
            .map_err(|e| format!("request write: {e:?}"))?;
        drop(stream);
    }
    OutgoingBody::finish(out_body, None).map_err(|e| format!("request finish: {e:?}"))?;

    let step = STEP_TIMEOUT.as_nanos() as u64;
    let options = RequestOptions::new();
    let _ = options.set_connect_timeout(Some(step));
    let _ = options.set_first_byte_timeout(Some(step));
    let _ = options.set_between_bytes_timeout(Some(step));

    let future = outgoing_handler::handle(req, Some(options)).map_err(|e| format!("send: {e:?}"))?;
    future.subscribe().block();
    let resp = future
        .get()
        .ok_or("no response")?
        .map_err(|()| "response already taken".to_string())?
        .map_err(|e| format!("http: {e:?}"))?;
    drop(future);

    let status = resp.status();
    let incoming = resp.consume().map_err(|()| "consume body".to_string())?;
    drop(resp);
    let stream = incoming.stream().map_err(|()| "body stream".to_string())?;
    let mut bytes = Vec::new();
    loop {
        if started.elapsed() > TOTAL_TIMEOUT {
            return Err("response too slow".into());
        }
        match stream.blocking_read(64 * 1024) {
            Ok(mut chunk) => {
                bytes.append(&mut chunk);
                if bytes.len() > MAX_BODY {
                    return Err("response too large".into());
                }
            }
            Err(StreamError::Closed) => break,
            Err(e) => return Err(format!("read: {e:?}")),
        }
    }
    drop(stream);
    drop(incoming);
    Ok(HttpResp { status, body: bytes })
}
