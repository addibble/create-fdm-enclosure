import { FdmEnclosureSolverDebugger } from "../site/fdm-enclosure-solver-debugger"
import { prefabBoardInput } from "./prefab-board-scene"

export default function PrefabBoardFixture(): React.JSX.Element {
  return <FdmEnclosureSolverDebugger input={prefabBoardInput} />
}
