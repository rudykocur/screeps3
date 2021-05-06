import { StructureWithEnergyStorage } from "types";
import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";


interface TransferResourceMemory {
    actorId: Id<Creep>;
    structureId: Id<StructureWithEnergyStorage>;
}

interface TransferResourceArgs {
    actor: Creep;
    structure: StructureWithEnergyStorage;
}

@PersistentTask.register
export class TrasferResourceTask extends PersistentTask<TransferResourceMemory, TransferResourceArgs> {
    private actor?: Creep | null
    private structure?: StructureWithEnergyStorage | null

    initMemory(args: TransferResourceArgs): TransferResourceMemory {
        return {
            actorId: args.actor.id,
            structureId: args.structure.id,
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId);
        this.structure = Game.getObjectById(this.memory.structureId);
    }

    doRun(): RunResultType {
        if(!this.actor || !this.structure) {
            return RunResult.DONE
        }

        if(this.actor.store.getUsedCapacity() === 0) {
            return RunResult.DONE
        }

        if(this.structure.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            return RunResult.DONE
        }

        if(this.actor.pos.isNearTo(this.structure)) {
            this.actor.transfer(this.structure, RESOURCE_ENERGY)
        }
        else {
            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: this.structure.pos,
                range: 1,
            })
        }
    }

    toString() {
        return `[TransferResourceTask actor=${this.actor} structure=${this.structure}]`
    }
}
