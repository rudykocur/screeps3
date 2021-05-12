import { TaskWithActor } from "TaskManager";
import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";

interface PickupResourceMemory {
    actorId: Id<Creep>
    resourceId: Id<Resource>
}

interface PickupResourceArgs {
    actor: Creep
    resource: Resource
}

@PersistentTask.register
export class PickupResourceTask extends PersistentTask<PickupResourceMemory, PickupResourceArgs> implements TaskWithActor {
    private actor?: Creep | null
    private resource?: Resource | null

    initMemory(args: PickupResourceArgs): PickupResourceMemory {
        return {
            actorId: args.actor.id,
            resourceId: args.resource.id,
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        this.resource = Game.getObjectById(this.memory.resourceId)
    }

    doRun(): RunResultType {
        if(!this.actor || !this.resource) {
            return RunResult.DONE
        }

        if(this.actor.store.getFreeCapacity() === 0) {
            return RunResult.DONE
        }

        if(this.actor.pos.isNearTo(this.resource)) {
            this.actor.pickup(this.resource)
        }
        else {
            const carry = this.actor.store.getCapacity()
            Game.reservationManager.getHandler(this.resource)?.reserve(this, carry)

            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: this.resource.pos,
                range: 1,
            })
        }
    }

    getActorId() {
        return this.actor?.id
    }

    toString() {
        return `[PickupResource actor=${this.actor} resource=${this.resource}]`
    }
}
