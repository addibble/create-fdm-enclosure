import type { GraphicsObject } from "graphics-debug"
import {
  type EnclosureFace,
  getEnclosureSpanAlongAxis,
  getFaceTangentAxes,
  isHorizontalFace,
  type ResolvedEnclosureAperturePlacement,
} from "../enclosure"
import type {
  ResolvedFdmEnclosureDimensions,
  ResolvedFdmEnclosureInput,
} from "./types"

const WALL_ORDER: EnclosureFace[] = ["y_pos", "x_pos", "y_neg", "x_neg"]
const PANEL_GAP = 5

/**
 * How wide a wall is when laid flat -- its span along its own first tangent
 * axis, which is the same quantity an aperture is bounds-checked against.
 */
const getWallLength = (
  wall: EnclosureFace,
  dimensions: ResolvedFdmEnclosureDimensions,
): number => getEnclosureSpanAlongAxis(dimensions, getFaceTangentAxes(wall)[0])

const getWallPanelCenters = (
  dimensions: ResolvedFdmEnclosureDimensions,
): Map<EnclosureFace, number> => {
  const centers = new Map<EnclosureFace, number>()
  const totalWidth = WALL_ORDER.reduce(
    (sum, wall) => sum + getWallLength(wall, dimensions),
    PANEL_GAP * (WALL_ORDER.length - 1),
  )
  let cursor = -totalWidth / 2

  for (const wall of WALL_ORDER) {
    const length = getWallLength(wall, dimensions)
    centers.set(wall, cursor + length / 2)
    cursor += length + PANEL_GAP
  }

  return centers
}

const getPanelCenter = (
  centers: Map<EnclosureFace, number>,
  wall: EnclosureFace,
): number => {
  const center = centers.get(wall)
  if (center === undefined) throw new Error(`Missing ${wall} wall panel`)
  return center
}

const addApertureGraphics = ({
  graphics,
  placement,
  panelCenterX,
  planViewY,
  isProcessed,
}: {
  graphics: GraphicsObject
  placement: ResolvedEnclosureAperturePlacement
  panelCenterX: number
  planViewY: number
  isProcessed: boolean
}): void => {
  const { aperture, width, height } = placement
  // The unrolled strip shows every wall as if standing OUTSIDE it. Facing the
  // front (+Y) or left (-X) wall from outside reverses the along-wall screen
  // direction, so their offset is mirrored here to match the 3D render and the
  // physical wall instead of appearing left/right reversed.
  const alongWall =
    placement.face === "y_pos" || placement.face === "y_neg"
      ? placement.center.x
      : placement.center.y
  const offsetSign =
    placement.face === "y_pos" || placement.face === "x_neg" ? -1 : 1
  const center = isHorizontalFace(placement.face)
    ? // Plan view: the aperture keeps its board X/Y.
      { x: placement.center.x, y: planViewY + placement.center.y }
    : { x: panelCenterX + offsetSign * alongWall, y: placement.center.z }
  const fill = isProcessed
    ? "rgba(239, 68, 68, 0.4)"
    : "rgba(148, 163, 184, 0.12)"
  const stroke = isProcessed ? "#dc2626" : "#94a3b8"
  // Side-face apertures sit under a labelled wall panel, so repeating the face
  // would be redundant. Plan-view apertures have no panel header, so they carry
  // it -- that is the only way to tell a `top` hole from a `bottom` one.
  const facePrefix = isHorizontalFace(placement.face)
    ? `${placement.face} `
    : ""
  const label = `${facePrefix}${aperture.shape} ${width.toFixed(1)}×${height.toFixed(1)}`

  if (aperture.shape === "rect") {
    graphics.rects?.push({ center, width, height, fill, stroke, label })
    return
  }

  if (aperture.shape === "circle") {
    graphics.circles?.push({
      center,
      radius: width / 2,
      fill,
      stroke,
      label,
    })
    return
  }

  const isHorizontal = width >= height
  const radius = Math.min(width, height) / 2
  const centerLength = Math.abs(width - height)
  graphics.rects?.push({
    center,
    width: isHorizontal ? centerLength : width,
    height: isHorizontal ? height : centerLength,
    fill,
    stroke,
    label,
  })
  graphics.circles?.push(
    {
      center: {
        x: center.x + (isHorizontal ? -centerLength / 2 : 0),
        y: center.y + (isHorizontal ? 0 : -centerLength / 2),
      },
      radius,
      fill,
      stroke,
    },
    {
      center: {
        x: center.x + (isHorizontal ? centerLength / 2 : 0),
        y: center.y + (isHorizontal ? 0 : centerLength / 2),
      },
      radius,
      fill,
      stroke,
    },
  )
}

export const visualizeFdmEnclosure = ({
  title,
  resolved,
  processedApertureCount = 0,
}: {
  title: string
  resolved: ResolvedFdmEnclosureInput
  processedApertureCount?: number
}): GraphicsObject => {
  const { board, dimensions } = resolved
  const graphics: GraphicsObject = {
    title,
    coordinateSystem: "cartesian",
    rects: [],
    circles: [],
    lines: [],
    points: [],
    texts: [],
  }
  const centers = getWallPanelCenters(dimensions)
  const topViewY = -dimensions.height / 2 - PANEL_GAP

  for (const wall of WALL_ORDER) {
    const centerX = getPanelCenter(centers, wall)
    graphics.rects?.push({
      center: { x: centerX, y: dimensions.depth / 2 },
      width: getWallLength(wall, dimensions),
      height: dimensions.depth,
      fill: "rgba(59, 130, 246, 0.08)",
      stroke: "#2563eb",
      label: wall,
    })
    graphics.texts?.push({
      x: centerX,
      y: dimensions.depth + 1.5,
      text: wall,
      anchorSide: "bottom_center",
      color: "#1e3a8a",
      fontSize: 1.5,
    })
  }

  for (const [index, placement] of resolved.apertures.entries()) {
    // Side faces are drawn on the unrolled elevation strip; `top`/`bottom` faces
    // have no elevation, so they are drawn in the plan view instead.
    addApertureGraphics({
      graphics,
      placement,
      panelCenterX: isHorizontalFace(placement.face)
        ? 0
        : getPanelCenter(centers, placement.face),
      planViewY: topViewY,
      isProcessed: index < processedApertureCount,
    })
  }

  graphics.rects?.push(
    {
      center: { x: 0, y: topViewY },
      width: dimensions.width,
      height: dimensions.height,
      fill: "rgba(59, 130, 246, 0.05)",
      stroke: "#1d4ed8",
      label: "enclosure top view",
    },
    {
      center: { x: 0, y: topViewY },
      width: board.width,
      height: board.height,
      fill: "rgba(34, 197, 94, 0.18)",
      stroke: "#15803d",
      label: "board",
    },
  )

  return graphics
}
