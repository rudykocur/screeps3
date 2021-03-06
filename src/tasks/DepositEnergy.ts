import { RunResult, RunResultType } from "./AbstractTask";
import { DropResourceTask } from "./DropResource";
import { PersistentTask } from "./PersistentTask";
import { TransferResourceTask } from "./TransferResourceTask";
import { TaskWithActor } from "TaskManager";
import { IRoomManager } from "interfaces";

interface DepositEnergyMemory {
    actorId: Id<Creep>
    roomName: string
}

interface DepositEnergyArgs {
    actor: Creep
    room: IRoomManager
}

@PersistentTask.register
export class DepositEnergy extends PersistentTask<DepositEnergyMemory, DepositEnergyArgs> implements TaskWithActor {

    private actor?: Creep | null;
    private room: IRoomManager;

    initMemory(args: DepositEnergyArgs): DepositEnergyMemory {
        return {
            actorId: args.actor.id,
            roomName: args.room.name,
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId);
        const room = Game.manager.getOwnedRoomManager(this.memory.roomName);

        if(room) {
            this.room = room;
        }
    }

    doRun(): RunResultType {
        if(!this.actor) {
            return RunResult.DONE
        }

        if(this.actor.store.getUsedCapacity() === 0) {
            return RunResult.DONE
        }

        const analyst = this.room.getRoomAnalyst()

        if(!analyst) {
            return
        }

        const storage = analyst.getStorage()

        if(!storage) {
            return
        }

        if(storage.isConstructed()) {
            if(storage.isFull()) {
                return RunResult.DONE
            }

            if(storage.storage) {
                this.scheduleBlockingTask(TransferResourceTask, {
                    actor: this.actor,
                    container: storage.storage
                })
            }
            if(storage.container) {
                this.scheduleBlockingTask(TransferResourceTask, {
                    actor: this.actor,
                    container: storage.container
                })
            }
        }
        else {
            this.scheduleBlockingTask(DropResourceTask, {
                actor: this.actor,
                target: storage.location,
            })
        }
    }

    getActorId() {
        return this.actor?.id
    }

    toString() {
        return `[DepositEnergy actor=${this.actor} room=${this.room}]`
    }
}
