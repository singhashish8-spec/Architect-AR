// A single Revit/IFC parameter, flattened out of an IfcPropertySet for
// display in the data panel. See docs/features/element-data-inspection.md.
export interface IfcProperty {
  name: string
  value: string
}

export interface IfcElementData {
  expressId: number
  // IFC entity type, e.g. "IFCWALLSTANDARDCASE" -- shown as a friendly
  // label, see ifc/friendlyTypeName.ts.
  type: string
  name: string | null
  properties: IfcProperty[]
}
