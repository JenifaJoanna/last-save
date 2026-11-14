// The Slot's corner tag for a drawn stand-in (Slot itself would fill the frame with "Take pending"), so a review can
// tell a motion-graphics stand-in from a real take. Same look as Slot's tag.
import { Label } from "../../../ds/type";
import { T } from "../../../ds/tokens";

export function PendingTag({ slot }: { slot: string }) {
  return (
    <Label size={14} color={T.faint} style={{ position: "absolute", right: 14, bottom: 10, background: "rgba(10,8,20,0.7)", padding: "3px 8px", borderRadius: 3 }}>
      placeholder · {slot}
    </Label>
  );
}
