//! Minimal RLP and the one transaction shape we sign: an EIP-1559 (type 0x02) plain ETH
//! transfer. Checked against ethers-encoded vectors (tests/fixtures/evm-vectors.json).

/// RLP string item.
pub fn put_bytes(out: &mut Vec<u8>, b: &[u8]) {
    if b.len() == 1 && b[0] < 0x80 {
        out.push(b[0]);
        return;
    }
    put_len(out, b.len(), 0x80);
    out.extend_from_slice(b);
}

fn put_len(out: &mut Vec<u8>, len: usize, base: u8) {
    if len < 56 {
        out.push(base + len as u8);
    } else {
        let be = (len as u64).to_be_bytes();
        let skip = be.iter().take_while(|b| **b == 0).count();
        out.push(base + 55 + (8 - skip) as u8);
        out.extend_from_slice(&be[skip..]);
    }
}

/// Integer from big-endian bytes: no leading zeros, zero is the empty string.
pub fn put_uint_be(out: &mut Vec<u8>, be: &[u8]) {
    let skip = be.iter().take_while(|b| **b == 0).count();
    put_bytes(out, &be[skip..]);
}

pub fn put_uint(out: &mut Vec<u8>, v: u128) {
    put_uint_be(out, &v.to_be_bytes());
}

/// Wraps an already-encoded payload as an RLP list.
pub fn list(payload: &[u8]) -> Vec<u8> {
    let mut o = Vec::with_capacity(payload.len() + 9);
    put_len(&mut o, payload.len(), 0xc0);
    o.extend_from_slice(payload);
    o
}

/// Base Sepolia.
pub const EVM_CHAIN_ID: u64 = 84532;

/// Everything that goes into a plain-transfer EIP-1559 transaction (empty data and access list).
pub struct Tx1559 {
    pub nonce: u64,
    pub max_priority_fee: u128,
    pub max_fee: u128,
    pub gas_limit: u64,
    pub to: [u8; 20],
    pub value: u128,
}

impl Tx1559 {
    fn fields(&self) -> Vec<u8> {
        let mut f = Vec::with_capacity(64);
        put_uint(&mut f, EVM_CHAIN_ID as u128);
        put_uint(&mut f, self.nonce as u128);
        put_uint(&mut f, self.max_priority_fee);
        put_uint(&mut f, self.max_fee);
        put_uint(&mut f, self.gas_limit as u128);
        put_bytes(&mut f, &self.to);
        put_uint(&mut f, self.value);
        put_bytes(&mut f, &[]); // data
        f.extend_from_slice(&list(&[])); // access list
        f
    }

    /// `0x02 || rlp([chainId, nonce, maxPriorityFee, maxFee, gasLimit, to, value, data, accessList])`.
    pub fn unsigned(&self) -> Vec<u8> {
        let mut o = vec![0x02];
        o.extend_from_slice(&list(&self.fields()));
        o
    }

    /// keccak256 of the unsigned encoding: the payload the MPC signer signs.
    pub fn payload(&self) -> [u8; 32] {
        near_sdk::env::keccak256_array(&self.unsigned())
    }

    /// The raw transaction a relayer can broadcast: fields followed by yParity, r, s.
    pub fn signed(&self, y_parity: u8, r: &[u8; 32], s: &[u8; 32]) -> Vec<u8> {
        let mut f = self.fields();
        put_uint(&mut f, y_parity as u128);
        put_uint_be(&mut f, r);
        put_uint_be(&mut f, s);
        let mut o = vec![0x02];
        o.extend_from_slice(&list(&f));
        o
    }
}
