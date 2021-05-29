import { RoomAnalyst } from "tasks/RoomAnalyst";

export interface StatMemory {
    partials: string
    average: number
}

export interface StatProvider {
    run(analyst: RoomAnalyst): void
}
