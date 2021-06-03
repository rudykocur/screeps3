import { GenericTask } from "TaskManager"
import { StructureWithGeneralStorage, Optional, ReservableStructures } from "types"
import { IReservationManager, ReservableHandler, ReservationChunk, ReservationMemory } from "./common"

interface ContainerReservationChunk extends ReservationChunk {
    amount: number
}

interface ContainerReservationMemory extends ReservationMemory {
    containerId: Id<ReservableStructures>
    name?: string,
    chunks: ContainerReservationChunk[]
}

function isTombstone(obj: ReservableStructures): obj is Tombstone {
    return 'deathTime' in obj
}

function isRuin(obj: ReservableStructures): obj is Ruin {
    return 'destroyTime' in obj
}

@IReservationManager.registerReservationHandler
export class ContainerReservation implements ReservableHandler {

    private container?: Optional<ReservableStructures>
    private reservedChunks: ContainerReservationChunk[]

    constructor(private manager: IReservationManager) {}

    initMemory(target: ReservableStructures): ContainerReservationMemory {
        return {
            containerId: target.id,
            name: target.toString(),
            chunks: [],
            volatile: isTombstone(target) || isRuin(target)
        }
    }

    init(memory: ContainerReservationMemory): void {
        this.container = Game.getObjectById(memory.containerId)
        this.reservedChunks = memory.chunks
    }

    getTargetId() {
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
