import { StructureWithEnergyStorage, StructureWithGeneralStorage } from "types";
import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";

interface LoadEnergyMemory {
    actorId: Id<Creep>
    structureId?: Id<StructureWithEnergyStorage>
    containerId?: Id<StructureWithGeneralStorage>
}

interface LoadEnergyArgs {
    actor: Creep
    structure?: StructureWithEnergyStorage
    container?: StructureWithGeneralStorage
}

@PersistentTask.register
export class LoadEnergyTask extends PersistentTask<LoadEnergyMemory, LoadEnergyArgs> {

    private actor?: Creep | null
    private structure?: StructureWithEnergyStorage | null
    private container?: StructureWithGeneralStorage | null

    initMemory(args: LoadEnergyArgs): LoadEnergyMemory {
        return {
            actorId: args.actor.id,
            structureId: args.structure?.id,
            containerId: args.container?.id,
        }
    }
    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId);
        this.structure = this.memory.structureId ? Game.getObjectById(this.memory.structureId) : null
        this.container = this.memory.containerId ? Game.getObjectById(this.memory.containerId) : null
    }

    doRun(): RunResultType {
        const target = this.container || this.structure

        if(!this.actor || !target) {
            return RunResult.DONE
        }

        if(this.actor.store.getFreeCapacity() === 0) {
            return RunResult.DONE
        }

        if(this.actor.pos.isNearTo(target)) {
            this.actor.withdraw(target, RESOURCE_ENERGY)
        }
        else {
            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: target.pos,
                range: 1,
            })
        }
    }

    toString() {
        return `[LoadEnergyTask actor=${this.actor} target=${this.structure || this.container}]`
    }
}
