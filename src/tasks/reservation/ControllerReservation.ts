import { GenericTask } from "TaskManager"
import { Optional } from "types"
import { IReservationManager, ReservableHandler, ReservationChunk, ReservationMemory } from "./common"

interface ControllerReservationMemory extends ReservationMemory {
    controllerId: Id<StructureController>
    name?: string,
    chunks: ReservationChunk[]
}

@IReservationManager.registerReservationHandler
export class ControllerReservation implements ReservableHandler {

    private controller?: Optional<StructureController>
    private reservedChunks: ReservationChunk[]

    constructor(private manager: IReservationManager) {}

    initMemory(target: StructureController): ControllerReservationMemory {
        return {
            controllerId: target.id,
            chunks: [],
        }
    }

    init(memory: ControllerReservationMemory): void {
        this.controller = Game.getObjectById(memory.controllerId)
        this.reservedChunks = memory.chunks
    }

    getTargetId() {
        return this.controller?.id
    }

    reserve(task: GenericTask) {
        const reservationId = this.manager.createReservation(task)

        this.reservedChunks.push({
            reservationId: reservationId,
        })
    }

    getReservedAmount() {
        return this.reservedChunks.length
    }
}
