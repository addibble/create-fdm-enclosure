import type { CreateFdmEnclosureInput } from "../lib/index"
import { createFdmEnclosure } from "../lib/index"

const boardThickness = 1.4
const floorThickness = 2
const standoffHeight = 4
/**
 * Solver-native adaptation of the prefab-board enclosure example.
 *
 * It intentionally includes only the board slab, seven connector CAD
 * occurrences, and the generated base/lid. PCB mounting hardware is deferred.
 */
export const prefabBoardInput: CreateFdmEnclosureInput = {
  board: {
    width: 75,
    height: 55,
    thickness: boardThickness,
  },
  wallThickness: 2,
  floorThickness,
  lidThickness: 2,
  boardClearance: 0.8,
  standoffHeight,
  topHeadroom: 20,
  lidLipDepth: 4,
  apertures: [
    {
      shape: "pill",
      face: "y_pos",
      width: 9.2,
      height: 3.3,
      center: { x: -18, y: 0 },
      componentBody: { aboveBoardHeight: 11 },
    },
    {
      shape: "pill",
      face: "x_pos",
      width: 3.66,
      height: 8.34,
      center: { y: -12, x: 0 },
      componentBody: { aboveBoardHeight: 13.270001 },
    },
    {
      shape: "pill",
      face: "y_neg",
      width: 8,
      height: 3,
      center: { x: -18, y: 0 },
      componentBody: { aboveBoardHeight: 3.66 },
    },
    {
      shape: "rect",
      face: "y_neg",
      width: 6,
      height: 13.2,
      center: { x: 15, y: 0 },
      componentBody: { aboveBoardHeight: 18.103753 },
    },
    {
      shape: "rect",
      face: "x_pos",
      width: 8.5,
      height: 10,
      center: { y: 10, x: 0 },
      componentBody: { aboveBoardHeight: 12.4 },
    },
    {
      shape: "circle",
      face: "y_pos",
      radius: 3.25,
      center: { x: 10, y: 0 },
      componentBody: { aboveBoardHeight: 5.84998 },
    },
    {
      shape: "circle",
      face: "x_neg",
      radius: 3.25,
      center: { y: -12, x: 0 },
      componentBody: { aboveBoardHeight: 13 },
    },
  ],
}

interface ConnectorCadOccurrence {
  name: `J${number}`
  manufacturerPartNumber: string
  pcbCenter: { x: number; y: number }
  pcbSize: { width: number; height: number }
  pcbRotation: number
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  modelObjUrl: string
  modelOriginPosition?: { x: number; y: number; z: number }
}

const connectorCadOccurrences: ConnectorCadOccurrence[] = [
  {
    name: "J1",
    manufacturerPartNumber: "USB_TYPE_C_018",
    pcbCenter: { x: -18, y: -22.924999175 },
    pcbSize: { width: 9.850224, height: 6.49817435 },
    pcbRotation: 0,
    position: { x: -18, y: -25.224999175, z: 0.7 },
    rotation: { x: 0, y: 0, z: 180 },
    modelObjUrl:
      "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=2a4bc2358b36497d9ab2a66ab6419ba3&pn=C2927038",
  },
  {
    name: "J2",
    manufacturerPartNumber: "TYPE-C 14P CC-2.6",
    pcbCenter: { x: 30, y: -12 },
    pcbSize: { width: 6.400382, height: 4.76004 },
    pcbRotation: 90,
    position: { x: 30, y: -12, z: 0.7 },
    rotation: { x: 0, y: 0, z: 90 },
    modelObjUrl:
      "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=fd858e85fa2e485f931f37c89f3b47bc&pn=C5187475",
    modelOriginPosition: { x: 0, y: 2.9750258, z: -2.330004 },
  },
  {
    name: "J3",
    manufacturerPartNumber: "MicroXNJ",
    pcbCenter: { x: -18, y: 22.9249991 },
    pcbSize: { width: 8.5496654, height: 4.5723302 },
    pcbRotation: 180,
    position: { x: -18, y: 22.9249991, z: 0.7 },
    rotation: { x: 0, y: 0, z: 180 },
    modelObjUrl:
      "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=a2b1a9114fe84000a47b1a073321bc87&pn=C404969",
    modelOriginPosition: { x: 0, y: -1.03103, z: -1.829854 },
  },
  {
    name: "J4",
    manufacturerPartNumber: "USB_AF___",
    pcbCenter: { x: 15, y: 14.5 },
    pcbSize: { width: 8.501634, height: 10.000234 },
    pcbRotation: 0,
    position: { x: 15, y: 14.5, z: 0.7 },
    rotation: { x: 0, y: 0, z: 0 },
    modelObjUrl:
      "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=3bd6558fce8e4714baff51bcd3febac1&pn=C26235",
    modelOriginPosition: { x: 0.000013, y: -3.223993, z: -1.003761 },
  },
  {
    name: "J5",
    manufacturerPartNumber: "DC_005_5A_2_0_SMT",
    pcbCenter: { x: 32.2, y: 10 },
    pcbSize: { width: 8.8998044, height: 13.8007344 },
    pcbRotation: 180,
    position: { x: 32.2, y: 10, z: 0.7 },
    rotation: { x: 0, y: 0, z: 90 },
    modelObjUrl:
      "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=1551b649d4464827bef52168672fd5ab&pn=C319134",
    modelOriginPosition: { x: 5.75, y: -3.049988, z: 0.099997 },
  },
  {
    name: "J6",
    manufacturerPartNumber: "PJ_320D",
    pcbCenter: { x: 10, y: -20.12500075 },
    pcbSize: { width: 8.499983, height: 11.8999 },
    pcbRotation: 90,
    position: { x: 10, y: -20.12500075, z: 0.7 },
    rotation: { x: 0, y: 0, z: 90 },
    modelObjUrl:
      "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=7178d96b87ee4d73a30dddb4c856adc2&pn=C431535",
    modelOriginPosition: { x: 7.27506, y: 0, z: -2.550001 },
  },
  {
    name: "J7",
    manufacturerPartNumber: "SMA_KWE",
    pcbCenter: { x: -33.5, y: -12 },
    pcbSize: { width: 7.539863, height: 7.540117 },
    pcbRotation: 0,
    position: { x: -33.5, y: -12, z: 0.7 },
    rotation: { x: 0, y: 0, z: 0 },
    modelObjUrl:
      "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=1336fc9149094e62873de2825f05e8fb&pn=C7498154",
    modelOriginPosition: { x: 4.283905, y: 1.233896, z: 1.499994 },
  },
]

const enclosure = createFdmEnclosure(prefabBoardInput)
const enclosurePosition = {
  x: 0,
  y: 0,
  z: -(enclosure.frame.boardBottomZ + boardThickness / 2),
}

export const prefabBoardCircuitJson = [
  {
    type: "source_assembly_device",
    source_assembly_device_id: "assembly_prefab",
    name: "prefab-board-enclosure",
  },
  {
    type: "source_board",
    source_board_id: "board_prefab",
  },
  {
    type: "source_fdm_enclosure",
    source_fdm_enclosure_id: "enclosure_prefab",
    source_assembly_device_id: "assembly_prefab",
    source_board_id: "board_prefab",
    wall_thickness: prefabBoardInput.wallThickness,
  },
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_prefab",
    center: { x: 0, y: 0 },
    width: prefabBoardInput.board.width,
    height: prefabBoardInput.board.height,
    thickness: boardThickness,
    num_layers: 2,
  },
  ...connectorCadOccurrences.flatMap((connector, index) => {
    const sourceComponentId = `source_component_${index}`
    const pcbComponentId = `pcb_component_${index}`
    return [
      {
        type: "source_component",
        source_component_id: sourceComponentId,
        ftype: "simple_connector",
        name: connector.name,
        manufacturer_part_number: connector.manufacturerPartNumber,
      },
      {
        type: "pcb_component",
        pcb_component_id: pcbComponentId,
        source_component_id: sourceComponentId,
        center: connector.pcbCenter,
        width: connector.pcbSize.width,
        height: connector.pcbSize.height,
        rotation: connector.pcbRotation,
        layer: "top",
        do_not_place: false,
        is_allowed_to_be_off_board: true,
        obstructs_within_bounds: true,
      },
      {
        type: "cad_component",
        cad_component_id: `cad_component_${index}`,
        source_component_id: sourceComponentId,
        pcb_component_id: pcbComponentId,
        position: connector.position,
        rotation: connector.rotation,
        model_obj_url: connector.modelObjUrl,
        model_origin_position: connector.modelOriginPosition,
        model_origin_alignment: "center_of_component_on_board_surface",
        anchor_alignment: "center_of_component_on_board_surface",
      },
    ]
  }),
  ...enclosure.parts.map((part) => ({
    type: "cad_fdm_enclosure",
    cad_fdm_enclosure_id: `cad_fdm_enclosure_${part.id}`,
    source_fdm_enclosure_id: "enclosure_prefab",
    name: `EN1.${part.id}`,
    position: enclosurePosition,
    rotation: { x: 0, y: 0, z: 0 },
    model_jscad: part.jscadPlan,
    model_unit_to_mm_scale_factor: 1,
    // Show the lid see-through so the board and its connectors stay visible.
    show_as_translucent_model: part.id === "lid",
  })),
]
