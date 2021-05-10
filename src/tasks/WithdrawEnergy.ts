import { TaskWithActor } from "TaskManager";
import { RunResult, RunResultType } from "./AbstractTask";
import { LoadEnergyTask } from "./LoadEnergyTask";
import { PersistentTask } from "./PersistentTask";
import { PickupResourceTask } from "./PickupResource";
import { RoomAnalyst } from "./RoomAnalyst";
import { RoomManager } from "./RoomManager";

interface WithdrawEnergyMemory {
    actorId: Id<Creep>
    roomName: string
    amount?: number
}

interface WithdrawEnergyArgs {
    actor: Creep
    room: RoomManager
    amount?: number
}

@PersistentTask.register
export class WithdrawEnergy extends PersistentTask<WithdrawEnergyMemory, WithdrawEnergyArgs> implements TaskWithActor {

    private actor?: Creep | null
    private room?: RoomManager | null
    private analyst?: RoomAnalyst | null
    private amount?: number

    initMemory(args: WithdrawEnergyArgs): WithdrawEnergyMemory {
        return {
            actorId: args.actor.id,
            roomName: args.room.name,
            amount: args.amount,
        }
    }
    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        this.room = Game.manager.getRoomManager(this.memory.roomName)
        this.analyst = this.room?.getRoomAnalyst()

        this.amount = this.memory.amount

    }
    doRun(): RunResultType {
        if(!this.actor || !this.room || !this.analyst) {
            return RunResult.DONE
        }

        if(this.amount && this.actor.store.getUsedCapacity() >= this.amount) {
            return RunResult.DONE
        }
        else if(this.actor.store.getFreeCapacity() === 0) {
            return RunResult.DONE
        }

        const storage = this.analyst.getStorage()

        if(!storage) {
            return
        }

        const target = storage.storage || storage.container

        if(target) {
            this.scheduleBlockingTask(LoadEnergyTask, {
                actor: this.actor,
                container: target,
                amount: this.amount,
            })
        }
    }

    getActorId() {
        return this.actor?.id
    }

    toString() {
        return `[WithdrawEnergy actor=${this.actor}]`
    }

}
