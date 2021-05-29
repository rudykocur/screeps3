import { Logger } from "Logger"
import { StatMemory } from "./interfaces"


export class StatsAggregator {
    private logger = new Logger('StatsAggregator')

    constructor(
        private name: string,
        private memory: StatMemory,
        private maxComponents: number
    ) {}

    get average() {
        return this.memory.average
    }

    add(value: number) {
        let parts = this.memory.partials ? this.memory.partials.split(',').map(part => parseInt(part)) : []

        parts.unshift(value)
        parts = parts.slice(0, this.maxComponents)

        this.memory.average = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)

        this.memory.partials = parts.join(',')

        this.logger.debug(`Added to set [${this.name}] new value`, value, ', average', this.memory.average)
    }
}
