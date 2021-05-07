import { TaskInitArgs, TaskMemory } from "types";
import { RunResult, RunResultType } from "../AbstractTask";
import { DepositEnergy } from "../DepositEnergy";
import { RoomManager } from "../RoomManager";
import { PersistentTask } from "../PersistentTask";
import { PickupResourceTask } from "../PickupResource";

interface HaulerCreepMemory extends TaskMemory {
    actorId: Id<Creep>;
    roomName: string;
}

interface HaulerCreepArgs extends TaskInitArgs {
    actor: Creep;
    room: RoomManager;
}

@PersistentTask.register
export class HaulerCreep extends PersistentTask<HaulerCreepMemory, HaulerCreepArgs> {

    private actor?: Creep | null;
    private room?: RoomManager | null;

    initMemory(args: HaulerCreepArgs): HaulerCreepMemory {
        return {
            actorId: args.actor.id,
            roomName: args.room.name,
        }
    }

    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId);
        this.room = Game.manager.getRoomManager(this.memory.roomName);
    }

    doRun(): RunResultType {
        if(!this.actor || !this.room) {
            return RunResult.DONE
        }

        if(this.actor.store.getFreeCapacity() > 0) {
            const resources = this.room.getDroppedResources();

            if(resources.length > 0) {
                const nearest = this.actor.pos.findClosestByRange(resources);
                this.scheduleBlockingTask(PickupResourceTask, {
                    actor: this.actor,
                    resource: nearest
                })
            }
        }
        else {
            this.scheduleBlockingTask(DepositEnergy, {
                actor: this.actor,
                room: this.room,
            })
        }
    }

    getActorId() {
        return this.actor?.id
    }

    toString() {
        return `[HaulerCreep actor=${this.actor}]`
    }
}
