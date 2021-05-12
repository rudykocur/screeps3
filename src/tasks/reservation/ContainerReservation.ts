import { GenericTask } from "TaskManager"
import { StructureWithGeneralStorage, Optional } from "types"
import { IReservationManager, ReservableHandler, ReservationChunk, ReservationMemory } from "./common"

interface ContainerReservationChunk extends ReservationChunk {
    amount: number
}

interface ContainerReservationMemory extends ReservationMemory {
    containerId: Id<StructureWithGeneralStorage>
    chunks: ContainerReservationChunk[]
}

@IReservationManager.registerReservationHandler
export class ContainerReservation implements ReservableHandler {

    private container?: Optional<StructureWithGeneralStorage>
    private reservedChunks: ContainerReservationChunk[]

    constructor(private manager: IReservationManager) {}

    initMemory(target: StructureWithGeneralStorage): ContainerReservationMemory {
        return {
            containerId: target.id,
            chunks: []
        }
    }

    init(memory: ContainerReservationMemory): void {
        this.container = Game.getObjectById(memory.containerId)
        this.reservedChunks = memory.chunks
    }

    getTargetId() {

        this.container?.structureType
        return this.container?.id
    }

    reserve(task: GenericTask, amount: number) {
        const reservationId = this.manager.createReservation(task)

        this.reservedChunks.push({
            reservationId: reservationId,
            amount: amount,
        })
    }

    getReservedAmount() {
        return this.reservedChunks.map(chunk => chunk.amount).reduce((sum, current) => sum + current, 0)
    }
}
