import { IRemoteRoom, IRoomManager } from "interfaces";
import { Logger } from "Logger";
import { TaskWithActor } from "TaskManager";
import { RunResult, RunResultType } from "tasks/AbstractTask";
import { MoveTask } from "tasks/MoveTask";
import { PersistentTask } from "tasks/PersistentTask";


interface ReserveRoomMemory {
    roomName: string
    parentRoomName?: string
    actorId: Id<Creep>
}

interface ReserveRoomArgs {
    room: IRemoteRoom
    actor: Creep
}

@PersistentTask.register
export class ReserveRoom extends PersistentTask<ReserveRoomMemory, ReserveRoomArgs> implements TaskWithActor {
    private manager?: IRoomManager
    private actor?: Creep | null
    private room?: Room | null

    private logger = new Logger('ReserveRoom')

    initMemory(args: ReserveRoomArgs): ReserveRoomMemory {
        return {
            roomName: args.room.name,
            parentRoomName: args.room.parentRoomName,
            actorId: args.actor.id
        }
    }
    doInit(): void {
        this.actor = Game.getObjectById(this.memory.actorId)
        this.room = Game.rooms[this.memory.roomName]

        if(this.memory.parentRoomName) {
            const parentRoom = Game.manager.getRoomManager(this.memory.parentRoomName)
            if(parentRoom) {
                this.manager = parentRoom.getRemoteRoom(this.memory.roomName)
            }
        }
    }
    doRun(): RunResultType {
        if(!this.manager || !this.actor) {
            return RunResult.DONE
        }

        if(!this.room) {
            this.scheduleBlockingTask(MoveTask, {
                actor: this.actor,
                target: new RoomPosition(25, 25, this.memory.roomName),
                range: 20
            })
        }
        else {
            const controller = this.room.controller

            if(controller) {
                if(!this.actor.pos.isNearTo(controller)) {
                    this.scheduleBlockingTask(MoveTask, {
                        actor: this.actor,
                        target: controller.pos,
                        range: 1
                    })
                }
                else {
                    this.actor.reserveController(controller)
                }
            }
        }
    }

    getActorId() {
        return this.actor?.id
    }

    toString() {
        return `[ReserveRoom room=${this.memory.roomName} actor=${this.actor}]`
    }
}
