import { RunResult, RunResultType } from "./AbstractTask";
import { DropResourceTask } from "./DropResource";
import { ManagerRoomTask } from "./ManagerRoomTask";
import { PersistentTask } from "./PersistentTask";
import { TrasferResourceTask } from "./TransferResourceTask";

interface DepositEnergyMemory {
    actorId: Id<Creep>;
    roomName: string;
}

interface DepositEnergyArgs {
    actor: Creep;
    room: ManagerRoomTask;
}

@PersistentTask.register
export class DepositEnergy extends PersistentTask<DepositEnergyMemory, DepositEnergyArgs> {

    private actor?: Creep | null;
    private room: ManagerRoomTask;

    initMemory(args: DepositEnergyArgs): DepositEnergyMemory {
        return {
            actorId: args.actor.id,
            roomName: args.room.name,
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId);
        const room = Game.manager.getRoomManager(this.memory.roomName);

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

        let toRefill = this.room.getStructuresNeedingEnergy();

        if(toRefill.length > 0) {
            this.scheduleBlockingTask(TrasferResourceTask, {
                actor: this.actor,
                structure: toRefill[0]
            })
            return
        }

        let target = this.room.temporaryStoragePosition;

        if(target !== undefined) {
            this.scheduleBlockingTask(DropResourceTask, {
                actor: this.actor,
                target: target,
            })
        }
    }

    toString() {
        return `[DepositEnergy actor=${this.actor} room=${this.room}]`
    }
}
