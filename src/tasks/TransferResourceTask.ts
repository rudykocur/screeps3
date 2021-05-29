import { TaskWithActor } from "TaskManager";
import { StructureWithEnergyStorage, StructureWithGeneralStorage } from "types";
import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";


interface TransferResourceMemory {
    actorId: Id<Creep>
    structureId?: Id<StructureWithEnergyStorage>
    containerId?: Id<StructureWithGeneralStorage>
}

interface TransferResourceArgs {
    actor: Creep
    structure?: StructureWithEnergyStorage
    container?: StructureWithGeneralStorage
}

@PersistentTask.register
export class TransferResourceTask extends PersistentTask<TransferResourceMemory, TransferResourceArgs> implements TaskWithActor {
    private actor?: Creep | null
    private structure?: StructureWithEnergyStorage | null
    private container?: StructureWithGeneralStorage | null

    initMemory(args: TransferResourceArgs): TransferResourceMemory {
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

        if(this.actor.store.getUsedCapacity() === 0) {
            return RunResult.DONE
        }

        if(this.container && this.container.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            return RunResult.DONE
        }

        if(this.structure && this.structure.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            return RunResult.DONE
        }

        if(this.actor.pos.isNearTo(target)) {
            this.actor.transfer(target, RESOURCE_ENERGY)
        }
        else {
            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: target.pos,
                range: 1,
            })
        }
    }

    reserveResouces(amount: number) {
        if(!this.actor || (!this.structure && !this.container)) {
            return
        }

        if(this.structure) {
            Game.reservationManager.getHandler(this.structure)?.reserve(this, amount)
        }

        if(this.container) {
            Game.reservationManager.getHandler(this.container)?.reserve(this, amount)
        }
    }

    getActorId() {
        return this.actor?.id
    }

    toString() {
        return `[TransferResourceTask actor=${this.actor} target=${this.structure || this.container}]`
    }
}
