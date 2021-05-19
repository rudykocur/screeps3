import { CreepCreatedEvent, SpawnerChannel, SPAWNER_BUS_NAME } from "bus/SpawnerEvents";
import { Logger } from "Logger";
import { ScoutCreepTemplate } from "spawner/CreepSpawnTemplate";
import { RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { RoomManager } from "./RoomManager";


interface RemoteRoomManagerMemory {
    roomName: string
    parentRoomName: string
    scout?: ScoutMemoryData
}

interface RemoteRoomManagerArgs {
    roomName: string
    parentRoom: RoomManager
}

interface ScoutMemoryData {
    spawnId?: string | null
    actorName?: string | null
}

@PersistentTask.register
export class RemoteRoomManager extends PersistentTask<RemoteRoomManagerMemory, RemoteRoomManagerArgs> {

    private room?: Room | null
    private parentRoom?: RoomManager

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

            // this.logger.debug(this, 'scout', this.scout, '::', this.spawnId)
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

    get name() {
        return this.memory.roomName
    }

    toString() {
        return `[RemoteRoomManager ${this.memory.roomName} parent=${this.parentRoom}]`
    }
}
