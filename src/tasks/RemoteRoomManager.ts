import { CreepCreatedEvent, SpawnerChannel, SPAWNER_BUS_NAME } from "bus/SpawnerEvents";
import { IOwnedRoomManager, IRoomManager } from "interfaces";
import { Logger } from "Logger";
import { RemoteRoomNeedGenerator } from "needs/NeedGenerator";
import { ScoutCreepTemplate } from "spawner/CreepSpawnTemplate";
import { RunResultType } from "./AbstractTask";
import { ReserveRoom } from "./creeps/ReserveRoom";
import { PersistentTask } from "./PersistentTask";
import { RoomAnalyst } from "./RoomAnalyst";

interface RemoteRoomManagerMemory {
    roomName: string
    parentRoomName: string
    scout?: ScoutMemoryData
}

interface RemoteRoomManagerArgs {
    roomName: string
    parentRoom: IOwnedRoomManager
}

interface ScoutMemoryData {
    spawnId?: string | null
    actorName?: string | null
}

@PersistentTask.register
export class RemoteRoomManager extends PersistentTask<RemoteRoomManagerMemory, RemoteRoomManagerArgs> implements IRoomManager{

    private room?: Room | null
    private parentRoom?: IOwnedRoomManager

    private analyst: RoomAnalyst | null
    private needGenerator: RemoteRoomNeedGenerator | null

    private scout?: Creep | null

    private spawnId?: string | null

    private logger = new Logger('RemoteRoomManager')

    initMemory(args: RemoteRoomManagerArgs): RemoteRoomManagerMemory {
        return {
            roomName: args.roomName,
            parentRoomName: args.parentRoom.name
        }
    }

    doInit(): void {
        this.parentRoom = Game.manager.getRoomManager(this.memory.parentRoomName)
        this.room = Game.rooms[this.memory.roomName]

        this.analyst = this.findTask(RoomAnalyst)
        this.needGenerator = this.findTask(RemoteRoomNeedGenerator)

        this.scout = this.memory.scout?.actorName ? Game.creeps[this.memory.scout?.actorName] : null

        if(!this.scout && this.memory.scout) {
            this.logger.info(this, 'scout died ...')
            this.memory.scout = undefined
        }
    }

    doRun(): RunResultType {
        if(!this.parentRoom) {
            return
        }

        this.parentRoom.getEventBus().getBus(SPAWNER_BUS_NAME).subscribe(SpawnerChannel.CREEP_CREATED, this.handleCreepCreated.bind(this))

        if(!this.room) {
            if(!this.memory.scout?.actorName) {
                this.spawnId = this.parentRoom.getSpawner().enqueue(new ScoutCreepTemplate(this.name))
            }
        }
        else {
            if(!this.analyst) {
                this.analyst = this.scheduleBackgroundTask(RoomAnalyst, {
                    roomName: this.name
                })
            }
            if(!this.needGenerator) {
                this.needGenerator = this.scheduleBackgroundTask(RemoteRoomNeedGenerator, {
                    room: this
                })
            }
        }

        if(this.scout) {
            const task = this.findTask(ReserveRoom)
            if(!task) {
                this.scheduleBackgroundTask(ReserveRoom, {
                    room: this,
                    actor: this.scout
                })
            }
        }
    }

    handleCreepCreated(event: CreepCreatedEvent) {
        if(this.spawnId && event.spawnId === this.spawnId) {
            this.logger.important('Created scout for room ' + this.name)
            this.memory.scout = {
                actorName: event.creepName
            }
        }
    }

    getRoomAnalyst() {
        return this.analyst
    }

    getDroppedResources() {
        return []
    }

    get name() {
        return this.memory.roomName
    }

    get parentRoomName() {
        return this.parentRoom?.name
    }

    toString() {
        return `[RemoteRoomManager ${this.memory.roomName} parent=${this.memory.parentRoomName}]`
    }
}
