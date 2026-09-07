import { expect, test } from "bun:test"

test("the solver declares its hardware runtime and public type dependencies", async () => {
  const manifest = await Bun.file(
    new URL("../package.json", import.meta.url),
  ).json()

  expect(Object.keys(manifest.dependencies)).toEqual(
    expect.arrayContaining([
      "@tscircuit/jscad-assembly-hardware",
      "@tscircuit/modelprinter",
    ]),
  )
})
