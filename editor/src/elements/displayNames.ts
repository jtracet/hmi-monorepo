export const elementDisplayNames: Record<string, string> = {
    led: 'LED Indicator',
    toggle: 'Slide Switch',
    image: 'Image',
    line: 'Line',
    numInput: 'Numeric Input',
    numControl: 'Numeric Control',
    numDisplay: 'Numeric Indicator',
    graph: 'Time Graph',
    'time-graph': 'Time Graph',
    tank: 'Numeric Indicator Tank',
    ringSelector: 'Ring Selector',
    decorationText: 'Decoration Text',
}

export function getElementDisplayName(elementKey: string): string {
    return elementDisplayNames[elementKey] || elementKey
}
