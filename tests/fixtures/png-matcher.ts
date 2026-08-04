import { expect, type MatcherResult } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import looksSame from "looks-same"
import { captionPng } from "./caption-png"

export interface PngSnapshotOptions {
  /** Overrides the snapshot file name, which otherwise follows the test file. */
  name?: string
  /**
   * Printed into the top of the image. State what the render is supposed to
   * show, so a reviewer looking at the diff can tell a legitimate change from a
   * regression that was rebaselined by reflex.
   */
  caption?: string | string[]
}

const toMatchPngSnapshot = async function (
  this: unknown,
  receivedValue: Buffer | Uint8Array | Promise<Buffer | Uint8Array>,
  testPath: string,
  options?: string | PngSnapshotOptions,
): Promise<MatcherResult> {
  const { name: snapshotName, caption } =
    typeof options === "string"
      ? { name: options, caption: undefined }
      : (options ?? {})
  const rendered = await receivedValue
  const received = caption
    ? captionPng(rendered, Array.isArray(caption) ? caption : [caption])
    : rendered
  const testBasePath = testPath.replace(/\.test\.tsx?$/, "")
  const snapshotDirectory = path.join(
    path.dirname(testBasePath),
    "__snapshots__",
  )
  const fileName = snapshotName
    ? `${snapshotName}.snap.png`
    : `${path.basename(testBasePath)}.snap.png`
  const snapshotPath = path.join(snapshotDirectory, fileName)
  fs.mkdirSync(snapshotDirectory, { recursive: true })

  if (!fs.existsSync(snapshotPath)) {
    fs.writeFileSync(snapshotPath, received)
    return {
      pass: true,
      message: () => `Created PNG snapshot at ${snapshotPath}`,
    }
  }

  const existing = fs.readFileSync(snapshotPath)
  const comparison = await looksSame(Buffer.from(received), existing, {
    strict: false,
    tolerance: 2,
  })
  const shouldUpdate =
    process.argv.includes("--update-snapshots") ||
    process.argv.includes("-u") ||
    Boolean(process.env.BUN_UPDATE_SNAPSHOTS)

  if (shouldUpdate) {
    fs.writeFileSync(snapshotPath, received)
    return { pass: true, message: () => "Updated PNG snapshot" }
  }
  if (comparison.equal) {
    return { pass: true, message: () => "PNG snapshot matches" }
  }

  const diffPath = snapshotPath.replace(/\.snap\.png$/, ".diff.png")
  await looksSame.createDiff({
    reference: existing,
    current: Buffer.from(received),
    diff: diffPath,
    highlightColor: "#ff00ff",
  })
  return {
    pass: false,
    message: () => `PNG snapshot differs; diff written to ${diffPath}`,
  }
}

expect.extend({ toMatchPngSnapshot: toMatchPngSnapshot as any })

declare module "bun:test" {
  interface Matchers<T = unknown> {
    toMatchPngSnapshot(
      testPath: string,
      options?: string | PngSnapshotOptions,
    ): Promise<MatcherResult>
  }
}
