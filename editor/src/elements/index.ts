import {LedIndicator} from './LedIndicator'
import {ToggleButton} from './ToggleButton'
import {ImageElement} from './ImageElement'
import {LineElement} from './LineElement'
import {NumberInput} from './NumberInput'
import {NumberControl} from './NumberControl'
import {NumberDisplay} from './NumberDisplay'
import {GraphElement} from './GraphElement'
import {Tank} from './Tank'
import {RingSelector} from './RingSelector'
import {DecorationText} from './DecorationText'

export const ElementRegistry: Record<string, any> = {
    led: LedIndicator,
    toggle: ToggleButton,
    image: ImageElement,
    line: LineElement,
    numInput: NumberInput,
    numControl: NumberControl,
    numDisplay: NumberDisplay,
    graph: GraphElement,
    'time-graph': GraphElement,  // alias — elementType used in saved files
    tank: Tank,
    ringSelector: RingSelector,
    decorationText: DecorationText,
}

export type ElementType = keyof typeof ElementRegistry
