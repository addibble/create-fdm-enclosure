import { PNG } from "pngjs"

/**
 * Burns a caption band into the top of a PNG so a reviewer reading a diff can
 * see what the image is *supposed* to show, not just that it changed.
 *
 * The glyphs are a hand-drawn 5x7 bitmap rather than real text, because these
 * PNGs are committed and compared pixel-wise: rendering type through a system
 * font would make the bytes depend on which fonts the machine happens to have,
 * so CI and a laptop would disagree on an unchanged render. A bitmap font is
 * identical everywhere. Uppercase-only for the same reason it is small - a
 * caption is a label, not prose.
 */

const GLYPH_WIDTH = 5
const GLYPH_HEIGHT = 7

// biome-ignore format: the glyph rows are the readable form of this data
const GLYPHS: Record<string, string[]> = {
  A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  B: ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
  C: [" ### ", "#   #", "#    ", "#    ", "#    ", "#   #", " ### "],
  D: ["#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### "],
  E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
  F: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
  G: [" ### ", "#   #", "#    ", "#  ##", "#   #", "#   #", " ### "],
  H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  I: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "#####"],
  J: ["    #", "    #", "    #", "    #", "#   #", "#   #", " ### "],
  K: ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
  L: ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  M: ["#   #", "## ##", "# # #", "#   #", "#   #", "#   #", "#   #"],
  N: ["#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #"],
  O: [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  Q: [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
  R: ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  U: ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  V: ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  W: ["#   #", "#   #", "#   #", "#   #", "# # #", "## ##", "#   #"],
  X: ["#   #", "#   #", " # # ", "  #  ", " # # ", "#   #", "#   #"],
  Y: ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "],
  Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
  "0": [" ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### "],
  "1": ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", "#####"],
  "2": [" ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####"],
  "3": ["#####", "   # ", "  #  ", "   # ", "    #", "#   #", " ### "],
  "4": ["   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "],
  "5": ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
  "6": ["  ## ", " #   ", "#    ", "#### ", "#   #", "#   #", " ### "],
  "7": ["#####", "    #", "   # ", "  #  ", " #   ", " #   ", " #   "],
  "8": [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "],
  "9": [" ### ", "#   #", "#   #", " ####", "    #", "   # ", " ##  "],
  " ": ["     ", "     ", "     ", "     ", "     ", "     ", "     "],
  "+": ["     ", "  #  ", "  #  ", "#####", "  #  ", "  #  ", "     "],
  "-": ["     ", "     ", "     ", "#####", "     ", "     ", "     "],
  "=": ["     ", "     ", "#####", "     ", "#####", "     ", "     "],
  ".": ["     ", "     ", "     ", "     ", "     ", " ##  ", " ##  "],
  ",": ["     ", "     ", "     ", "     ", " ##  ", " ##  ", " #   "],
  ":": ["     ", " ##  ", " ##  ", "     ", " ##  ", " ##  ", "     "],
  "/": ["    #", "    #", "   # ", "  #  ", " #   ", "#    ", "#    "],
  "(": ["   # ", "  #  ", " #   ", " #   ", " #   ", "  #  ", "   # "],
  ")": [" #   ", "  #  ", "   # ", "   # ", "   # ", "  #  ", " #   "],
  "<": ["    #", "   # ", "  #  ", " #   ", "  #  ", "   # ", "    #"],
  ">": ["#    ", " #   ", "  #  ", "   # ", "  #  ", " #   ", "#    "],
  "!": ["  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "     ", "  #  "],
  "?": [" ### ", "#   #", "    #", "   # ", "  #  ", "     ", "  #  "],
  "_": ["     ", "     ", "     ", "     ", "     ", "     ", "#####"],
  "'": ["  #  ", "  #  ", "     ", "     ", "     ", "     ", "     "],
}

const UNKNOWN = ["#####", "#   #", "#   #", "#   #", "#   #", "#   #", "#####"]

const SCALE = 2
const PAD = 6
const LINE_GAP = 3
const ADVANCE = (GLYPH_WIDTH + 1) * SCALE
const LINE_HEIGHT = GLYPH_HEIGHT * SCALE + LINE_GAP

const setPixel = (
  img: PNG,
  x: number,
  y: number,
  rgb: [number, number, number],
) => {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return
  const i = (img.width * y + x) << 2
  img.data[i] = rgb[0]
  img.data[i + 1] = rgb[1]
  img.data[i + 2] = rgb[2]
  img.data[i + 3] = 255
}

const drawText = (
  img: PNG,
  text: string,
  originX: number,
  originY: number,
  rgb: [number, number, number],
) => {
  let cursorX = originX
  for (const char of text.toUpperCase()) {
    const glyph = GLYPHS[char] ?? UNKNOWN
    for (let row = 0; row < GLYPH_HEIGHT; row++) {
      const bits = glyph[row]!
      for (let col = 0; col < GLYPH_WIDTH; col++) {
        if (bits[col] !== "#") continue
        for (let dy = 0; dy < SCALE; dy++)
          for (let dx = 0; dx < SCALE; dx++)
            setPixel(
              img,
              cursorX + col * SCALE + dx,
              originY + row * SCALE + dy,
              rgb,
            )
      }
    }
    cursorX += ADVANCE
  }
}

const textWidth = (text: string) => text.length * ADVANCE

/**
 * Returns a new PNG with `lines` printed in a band above the original image.
 * The first line is treated as the headline and drawn in black; any remaining
 * lines are drawn in grey as supporting detail.
 */
export const captionPng = (
  source: Buffer | Uint8Array,
  lines: string[],
): Buffer => {
  const original = PNG.sync.read(Buffer.from(source))
  const bandHeight = lines.length * LINE_HEIGHT - LINE_GAP + PAD * 2
  const widestLine = Math.max(...lines.map(textWidth))
  const width = Math.max(original.width, widestLine + PAD * 2)
  const output = new PNG({ width, height: original.height + bandHeight })

  output.data.fill(255)

  // A rule under the band keeps the caption from reading as part of the render.
  for (let x = 0; x < width; x++)
    setPixel(output, x, bandHeight - 1, [210, 210, 210])

  lines.forEach((line, index) => {
    drawText(
      output,
      line,
      PAD,
      PAD + index * LINE_HEIGHT,
      index === 0 ? [17, 17, 17] : [110, 110, 110],
    )
  })

  const offsetX = Math.floor((width - original.width) / 2)
  PNG.bitblt(
    original,
    output,
    0,
    0,
    original.width,
    original.height,
    offsetX,
    bandHeight,
  )

  return PNG.sync.write(output)
}
