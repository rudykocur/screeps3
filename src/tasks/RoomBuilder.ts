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

    initMemory(args: RoomBuilderArgs): RoomBuilderMemory {
        return {
            roomName: args.room.name
        }
    }
    doInit(): void {

    }

    doRun(): RunResultType {
        // console.log('OMG ANALYST', this.roomAnalyst)

        if(!this.roomAnalyst) {
            console.log("NO ANALYST :(")
            this.sleep(30)
            return
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
