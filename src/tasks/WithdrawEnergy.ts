import { RunResult, RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { PickupResourceTask } from "./PickupResource";
import { RoomManager } from "./RoomManager";

interface WithdrawEnergyMemory {
    actorId: Id<Creep>
    roomName: string
}

interface WithdrawEnergyArgs {
    actor: Creep
    room: RoomManager
}

@PersistentTask.register
export class WithdrawEnergy extends PersistentTask<WithdrawEnergyMemory, WithdrawEnergyArgs> {

    private actor?: Creep | null
    private room?: RoomManager | null

    initMemory(args: WithdrawEnergyArgs): WithdrawEnergyMemory {
        return {
            actorId: args.actor.id,
            roomName: args.room.name
        }
    }
    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        this.room = Game.manager.getRoomManager(this.memory.roomName)

    }
    doRun(): RunResultType {
        if(!this.actor || !this.room) {
            return RunResult.DONE
        }

        if(this.actor.store.getFreeCapacity() === 0) {
            return RunResult.DONE
        }

        const source = this.room.temporaryStoragePosition?.findInRange(FIND_DROPPED_RESOURCES, 1)

        if(source && source.length) {
            this.scheduleBlockingTask(PickupResourceTask, {
                actor: this.actor,
                resource: source[0]
            })
        }
    }

    toString() {
        return `[WithdrawEnergy ${this.actor}]`
    }

}
