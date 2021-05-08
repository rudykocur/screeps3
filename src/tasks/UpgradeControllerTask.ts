import { TaskWithActor } from "TaskManager";
import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";
import { RoomManager } from "./RoomManager";

interface UpgradeControllerMemory {
    actorId: Id<Creep>
    roomName: string
}

interface UpgradeControllerArgs {
    actor: Creep
    room: RoomManager
}

@PersistentTask.register
export class UpgradeControllerTask extends PersistentTask<UpgradeControllerMemory, UpgradeControllerArgs> implements TaskWithActor {

    private upgradeRange = 3
    private actor?: Creep | null
    private controller?: StructureController | null

    initMemory(args: UpgradeControllerArgs): UpgradeControllerMemory {
        return {
            actorId: args.actor.id,
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        this.controller = Game.rooms[this.memory.roomName].controller
    }

    doRun(): RunResultType {
        if(!this.actor || !this.controller) {
            return RunResult.DONE
        }

        if(this.actor.store.getUsedCapacity() === 0) {
            return RunResult.DONE
        }

        if(!this.actor.pos.inRangeTo(this.controller, this.upgradeRange)) {
            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: this.controller.pos,
                range: this.upgradeRange,
            })
        }
        else {
            this.actor.upgradeController(this.controller)
        }
    }

    getActorId() {
        return this.actor?.id
    }

    toString() {
        return `[UpgradeController actor=${this.actor} room=${this.memory.roomName}]`
    }
}
