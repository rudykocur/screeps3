import { GenericTask } from "TaskManager"
import { Optional } from "types"
import { ReservationChunk, ReservationMemory, ReservableHandler, IReservationManager } from "./common"

interface ResourceReservationChunk extends ReservationChunk {
    amount: number
}

interface ResourceReservationMemory extends ReservationMemory {
    resourceId: Id<Resource>
    chunks: ResourceReservationChunk[]
}

@IReservationManager.registerReservationHandler
export class ResourceReservation implements ReservableHandler {

    private resource?: Optional<Resource>
    private reservedChunks: ResourceReservationChunk[]

    constructor(private manager: IReservationManager) {}

    initMemory(target: Resource): ResourceReservationMemory {
        return {
            resourceId: target.id,
            chunks: [],
            volatile: true,
        }
    }

    init(memory: ResourceReservationMemory): void {
        this.resource = Game.getObjectById(memory.resourceId)
        this.reservedChunks = memory.chunks
    }

    getTargetId() {
        return this.resource?.id
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
