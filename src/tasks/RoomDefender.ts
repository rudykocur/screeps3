import { RunResultType } from "./AbstractTask";
import { PersistentTask } from "./PersistentTask";
import { RoomAnalyst } from "./RoomAnalyst";
import { RoomManager } from "./RoomManager";


interface RoomDefenderMemory {
    roomName: string
}

interface RoomDefenderArgs {
    room: RoomManager
}

@PersistentTask.register
export class RoomDefender extends PersistentTask<RoomDefenderMemory, RoomDefenderArgs> {

    private analyst?: RoomAnalyst
    private room?: Room | null

    initMemory(args: RoomDefenderArgs): RoomDefenderMemory {
        return {
            roomName: args.room.name
        }
    }

    doInit(): void {
        this.room = Game.rooms[this.memory.roomName]
    }

    doRun(): RunResultType {
        if(!this.room || !this.analyst) {
            return
        }

        const enemies = this.room.find(FIND_HOSTILE_CREEPS)

        if(enemies.length > 0) {
            this.defendRoom(this.analyst, enemies)
        }
        else {
            this.sleep(10)
        }
    }

    defendRoom(analyst: RoomAnalyst, enemies: Creep[]) {
        for(const tower of analyst.getTowers()) {
            const enemy = tower.pos.findClosestByRange(enemies)
            if(enemy) {
                tower.attack(enemy)
            }
        }
    }

    setAnalyst(anaylst: RoomAnalyst) {
        this.analyst = anaylst
    }

    toString() {
        return `[RoomDefender ${this.memory.roomName}]`
    }
}
