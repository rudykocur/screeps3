import { TaskWithActor } from "TaskManager";
import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";

interface RepairTaskMemory {
    actorId: Id<Creep>
    structureId: Id<Structure>
}

interface RepairTaskArgs {
    actor: Creep
    structure: Structure
}

@PersistentTask.register
export class RepairTask extends PersistentTask<RepairTaskMemory, RepairTaskArgs> implements TaskWithActor {

    private actor?: Creep | null
    private structure?: Structure | null

    private repairRange: number = 3

    initMemory(args: RepairTaskArgs): RepairTaskMemory {
        return {
            actorId: args.actor.id,
            structureId: args.structure.id
        }
    }
    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        this.structure = Game.getObjectById(this.memory.structureId)
    }

    doRun(): RunResultType {
        if(!this.actor || !this.structure) {
            return RunResult.DONE
        }

        if(this.actor.store.getUsedCapacity() === 0) {
            return RunResult.DONE
        }

        if(this.structure.hits === this.structure.hitsMax) {
            return RunResult.DONE
        }

        if(!this.actor.pos.inRangeTo(this.structure, this.repairRange)) {
            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: this.structure.pos,
                range: this.repairRange
            })
        }
        else {
            this.actor.repair(this.structure)
        }
    }

    getActorId() {
        return this.actor?.id
    }

    toString() {
        return `[RepairTask actor=${this.actor} target=${this.structure}]`
    }
}
