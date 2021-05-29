import { GenericTask } from "TaskManager"
import { ExtensionCluster } from "tasks/RoomAnalyst"
import { StructureWithGeneralStorage, Optional } from "types"
import { IReservationManager, ReservableHandler, ReservationChunk, ReservationMemory } from "./common"

interface ExtensionClusterReservationChunk extends ReservationChunk {
    amount: number
}

interface ExtensionClusterReservationMemory extends ReservationMemory {
    clusterId: string
    roomName: string
    chunks: ExtensionClusterReservationChunk[]
}

@IReservationManager.registerReservationHandler
export class ExtensionClusterReservation implements ReservableHandler {

    private cluster?: Optional<ExtensionCluster>
    private reservedChunks: ExtensionClusterReservationChunk[]

    constructor(private manager: IReservationManager) {}

    initMemory(target: ExtensionCluster): ExtensionClusterReservationMemory {
        return {
            clusterId: target.id,
            roomName: target.center.roomName,
            chunks: []
        }
    }

    init(memory: ExtensionClusterReservationMemory): void {
        const analyst = Game.manager.getOwnedRoomManager(memory.roomName)?.getRoomAnalyst()
        this.cluster = analyst?.getExtensionClusters().find(cluster => cluster.id === memory.clusterId)
        this.reservedChunks = memory.chunks
    }

    getTargetId() {
        return this.cluster?.id
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
