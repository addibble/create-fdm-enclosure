/**
 * The built-in fastener catalogue.
 *
 * Re-exported from `@tscircuit/jscad-assembly-hardware`, which owns it, so the
 * solver that sizes a boss and the renderer that draws the screw going into it
 * read the same numbers. This file used to hold a second copy; the two agreed
 * on every dimension and then disagreed on the geometry built from them, which
 * is the failure mode a duplicated table always eventually has.
 *
 * ## What may be in the catalogue
 *
 * A specification may exist only if a real vendor stocks that exact combination
 * of thread, length, head style and finish. Standards tables say what a
 * conforming part *would* measure; they do not say anybody sells it, and a BOM
 * line that cannot be bought fails at purchasing rather than at design time.
 * That is why button heads are listed for m3-m5 only, and why
 * `availableLengthsMm` is data rather than a formula.
 *
 * Where a platform supplies a fastener engine it supersedes these with live
 * vendor data including current availability; that is the mechanism intended to
 * keep the catalogue from becoming a stale copy of somebody else's.
 */
export {
  INSERT_SPECS,
  SCREW_HEAD_SPECS,
  THREAD_SPECS,
} from "@tscircuit/jscad-assembly-hardware"
