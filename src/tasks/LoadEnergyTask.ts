import { StructureWithEnergyStorage, StructureWithGeneralStorage, WithdrawableStructureWithGeneralStorage } from "types";
import { RunResult, RunResultType } from "./AbstractTask";
import { MoveTask } from "./MoveTask";
import { PersistentTask } from "./PersistentTask";

interface LoadEnergyMemory {
    actorId: Id<Creep>
    structureId?: Id<StructureWithEnergyStorage>
    containerId?: Id<WithdrawableStructureWithGeneralStorage>
    amount?: number
}

interface LoadEnergyArgs {
    actor: Creep
    structure?: StructureWithEnergyStorage
    container?: WithdrawableStructureWithGeneralStorage
    amount?: number
}

@PersistentTask.register
export class LoadEnergyTask extends PersistentTask<LoadEnergyMemory, LoadEnergyArgs> {

    private actor?: Creep | null
    private structure?: StructureWithEnergyStorage | null
    private container?: WithdrawableStructureWithGeneralStorage | null
    amount?: number;

    initMemory(args: LoadEnergyArgs): LoadEnergyMemory {
        return {
            actorId: args.actor.id,
            structureId: args.structure?.id,
            containerId: args.container?.id,
            amount: args.amount,
        }
    }
    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId);
        this.structure = this.memory.structureId ? Game.getObjectById(this.memory.structureId) : null
        this.container = this.memory.containerId ? Game.getObjectById(this.memory.containerId) : null
        this.amount = this.memory.amount
    }

    doRun(): RunResultType {
        const target = this.container || this.structure

        if(!this.actor || !target) {
            return RunResult.DONE
        }

        if(this.amount && this.actor.store.getUsedCapacity() >= this.amount) {
            return RunResult.DONE
        }
        else if(this.actor.store.getFreeCapacity() === 0) {
            return RunResult.DONE
        }

        if(this.container && !this.amount && this.container.store.getUsedCapacity() < 50) {
            return RunResult.DONE
        }

        if(this.container && this.amount && this.container.store.getUsedCapacity() < this.amount) {
            return RunResult.DONE
        }

        if(this.actor.pos.isNearTo(target)) {
            const result = this.actor.withdraw(target, RESOURCE_ENERGY, this.amount)
            if(result === ERR_NOT_ENOUGH_RESOURCES) {
                return RunResult.DONE
            }
        }
        else {
            if(this.container) {
                const carry = this.actor.store.getCapacity()
                Game.reservationManager.getHandler(this.container)?.reserve(this, carry)
            }

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
