import type { JscadOperation } from "jscad-planner"
import { getHeadRecessDepthMm } from "../hardware"
import type { FdmDesignRules } from "./design-rules"
import type { ResolvedFdmMount } from "./types"

const cylinder = ({
  diameterMm,
  bottomZ,
  topZ,
  x,
  y,
}: {
  diameterMm: number
  bottomZ: number
  topZ: number
  x: number
  y: number
}): JscadOperation => ({
  type: "translate",
  vector: [x, y, (bottomZ + topZ) / 2],
  shape: {
    type: "cylinder",
    radius: diameterMm / 2,
    height: topZ - bottomZ,
    resolution: 32,
  },
})

/**
 * What one screw boss adds to and removes from each printed part.
 *
 * Ordered contributions rather than inlined geometry, for the reason the
 * aperture cutouts are: a boss must be fused before it is bored, and the only
 * way to guarantee that without every builder remembering it is to keep adds and
 * subtracts separate and let composition apply them in that order.
 *
 * ## Which part gets what
 *
 * Both kinds of boss rise from the inside floor, which belongs to the **base**,
 * so both the cylinder and its bore are the base's. Only a lid mount touches the
 * **lid**, and only to let the screw through it: a clearance hole, and a recess
 * for the head where one was asked for.
 *
 * ## Frames
 *
 * Everything here is in enclosure-local coordinates: X and Y from the enclosure
 * centre, Z from the outside bottom upward, millimetres. That is the frame
 * `ResolvedFdmMount` already resolved its centre and its Z spans in, so this
 * function places and never re-derives.
 */
export interface FdmMountFeaturePlans {
  baseAdds: JscadOperation[]
  baseSubtracts: JscadOperation[]
  lidAdds: JscadOperation[]
  lidSubtracts: JscadOperation[]
}

export const createMountFeaturePlans = ({
  mount,
  rules,
  lidThicknessMm,
  totalHeightMm,
}: {
  mount: ResolvedFdmMount
  rules: FdmDesignRules
  lidThicknessMm: number
  totalHeightMm: number
}): FdmMountFeaturePlans => {
  const { center, bossBottomZ, bossTopZ } = mount
  const tolerance = rules.booleanTolerance

  const baseAdds: JscadOperation[] = [
    cylinder({
      diameterMm: mount.bossDiameterMm,
      // Sunk into the floor by the boolean tolerance so the union leaves no
      // zero-thickness seam between boss and floor for the mesher to argue over.
      bottomZ: bossBottomZ - tolerance,
      topZ: bossTopZ,
      ...center,
    }),
  ]

  const baseSubtracts: JscadOperation[] = [
    cylinder({
      diameterMm: mount.boreDiameterMm,
      bottomZ: bossTopZ - mount.boreDepthMm,
      // Over-cut upward only: the bore is meant to open at the top of the boss,
      // and its bottom is a real surface whose remaining floor was reserved
      // during resolution.
      topZ: bossTopZ + tolerance,
      ...center,
    }),
  ]
  const chamfer = mount.installation.boreEntryChamfer
  if (chamfer.depthMm > 0) {
    baseSubtracts.push({
      type: "hull",
      shapes: [
        cylinder({
          diameterMm: chamfer.outerDiameterMm,
          bottomZ: bossTopZ,
          topZ: bossTopZ + tolerance,
          ...center,
        }),
        cylinder({
          diameterMm: mount.boreDiameterMm,
          bottomZ: bossTopZ - chamfer.depthMm,
          topZ: bossTopZ - chamfer.depthMm + 1e-3,
          ...center,
        }),
      ],
    })
  }

  const lidAdds: JscadOperation[] = []
  const lidSubtracts: JscadOperation[] = []
  if (mount.mount.fastens === "lid") {
    const lidBottomZ = totalHeightMm - lidThicknessMm

    // The column belongs to the LID and hangs down. It is not a base feature:
    // a column standing up from the floor would occupy the very hole the board
    // has to be lowered over, so the board could never be installed.
    if (mount.lidColumn) {
      lidAdds.push(
        cylinder({
          diameterMm: mount.lidColumn.diameterMm,
          bottomZ: mount.lidColumn.bottomZ,
          // Overlapped into the plate so the union leaves no zero-thickness
          // seam for the mesher to argue over.
          topZ: mount.lidColumn.topZ + tolerance,
          ...center,
        }),
      )
    }

    // One clearance hole for the whole run the screw makes through lid-side
    // material: the plate, and the printed column when there is one. A spacer
    // needs no cut -- it is a bought tube that already has a bore. Cut after the
    // column is unioned, which composition guarantees.
    lidSubtracts.push(
      cylinder({
        diameterMm: mount.screwClearanceDiameterMm,
        bottomZ: (mount.lidColumn?.bottomZ ?? lidBottomZ) - tolerance,
        topZ: totalHeightMm + tolerance,
        ...center,
      }),
    )

    const recessDepthMm = getHeadRecessDepthMm({
      fastener: mount.fastener,
      headRecess: mount.headRecess,
      clearanceDiameterMm: mount.screwClearanceDiameterMm,
    })
    if (mount.headRecess === "counterbore") {
      lidSubtracts.push(
        cylinder({
          diameterMm:
            mount.fastener.head.diameterMm + rules.headRecessClearanceMm,
          bottomZ: totalHeightMm - recessDepthMm,
          topZ: totalHeightMm + tolerance,
          ...center,
        }),
      )
    } else if (mount.headRecess === "countersink") {
      // A cone, built as the hull of the two discs that bound it -- there is no
      // cone primitive in the plan vocabulary, and a hull of two coaxial discs
      // is exactly the frustum between them. The lower disc is the clearance
      // hole, so the cut meets the hole it continues rather than leaving a lip
      // for the head to catch on.
      //
      // The mouth is the head's own bearing diameter, with NO
      // `headRecessClearanceMm` added. That clearance is a counterbore's: it
      // keeps a cylindrical head from being a press fit, and depth is
      // independent of it. On a cone it is not clearance at all -- widening the
      // mouth without deepening the cut opens the angle, and the two together
      // are what set where the head lands. Adding it drew a 99.8-degree cone
      // for a 90-degree head, which touched only at the rim where the cone runs
      // into the clearance hole.
      //
      // `recessDepthMm` derives from the same head diameter and the head's own
      // angle (`getHeadRecessDepthMm`), so the cone is at the head's angle by
      // construction rather than by two tables agreeing.
      const topDiameterMm = mount.fastener.head.diameterMm
      lidSubtracts.push({
        type: "hull",
        shapes: [
          cylinder({
            diameterMm: topDiameterMm,
            bottomZ: totalHeightMm,
            topZ: totalHeightMm + tolerance,
            ...center,
          }),
          cylinder({
            diameterMm: mount.screwClearanceDiameterMm,
            bottomZ: totalHeightMm - recessDepthMm,
            topZ: totalHeightMm - recessDepthMm + 1e-3,
            ...center,
          }),
        ],
      })
    }
  }

  return { baseAdds, baseSubtracts, lidAdds, lidSubtracts }
}
