import {LedIndicator} from './LedIndicator'
import {ToggleButton} from './ToggleButton'
import {ImageElement} from './ImageElement'
import {LineElement} from './LineElement'
import {NumberInput} from './NumberInput'
import {NumberDisplay} from './NumberDisplay'
import {GraphElement} from './GraphElement'
import {Tank} from './Tank'

export const ElementRegistry = {
    led: LedIndicator,
    toggle: ToggleButton,
    image: ImageElement,
    line: LineElement,
    numInput: NumberInput,
    numDisplay: NumberDisplay,
    graph: GraphElement,
    tank: Tank
} as const

export type ElementType = keyof typeof ElementRegistry
