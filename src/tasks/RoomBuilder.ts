import { RunResultType } from "./AbstractTask";
import { RoomManager } from "./RoomManager";
import { PersistentTask } from "./PersistentTask";
import { RoomAnalyst } from "./RoomAnalyst";

interface RoomBuilderMemory {
    roomName: string
}

interface RoomBuilderArgs {
    room: RoomManager
}

@PersistentTask.register
export class RoomBuilder extends PersistentTask<RoomBuilderMemory, RoomBuilderArgs> {
    private roomAnalyst?: RoomAnalyst
    private room: Room

    initMemory(args: RoomBuilderArgs): RoomBuilderMemory {
        return {
            roomName: args.room.name
        }
    }
    doInit(): void {
        this.room = Game.rooms[this.memory.roomName]
    }

    doRun(): RunResultType {
        // console.log('OMG ANALYST', this.roomAnalyst)

        if(!this.roomAnalyst) {
            console.log("NO ANALYST :(")
            this.sleep(5)
            return
        }

        const storageData = this.roomAnalyst.getStorage()
        if(storageData) {
            if(this.room.controller && CONTROLLER_STRUCTURES[STRUCTURE_STORAGE][this.room.controller.level] > 0) {
                if(storageData.container) {
                    storageData.container.destroy()
                }

                storageData.location.createConstructionSite(STRUCTURE_STORAGE)
            }
            else {
                const result = storageData.location.createConstructionSite(STRUCTURE_CONTAINER)
            }
        }

        const sites = this.roomAnalyst.getMiningSites()
        for(const site of sites) {
            if(!site.container) {
                site.containerPos.createConstructionSite(STRUCTURE_CONTAINER)
            }
        }
    }

    setAnalyst(anaylst: RoomAnalyst) {
        this.roomAnalyst = anaylst
    }

    toString() {
        return `[RoomBuilder ${this.memory.roomName}]`
    }
}
