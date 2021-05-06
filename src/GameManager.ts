import { TaskManager } from "TaskManager";
import { counter } from "GlobalCounter";
import { ManagerRoomTask } from "tasks/ManagerRoomTask";

export class GameManager {
    private rooms: ManagerRoomTask[];
    private taskManager: TaskManager = new TaskManager();

    constructor() {
        this.rooms = [];
    }

    run() {
        Game.manager = this;

        counter.reset()

        this.cleanupCreeps();

        this.taskManager.loadPersistedTasks()
        this.taskManager.preInit()

        const tasks = this.taskManager.findTasks(ManagerRoomTask);

        Object.values(Game.rooms).forEach(room => {
            if(room.find(FIND_MY_SPAWNS).length === 0) {
                console.log("Skipping unowned room", room);
                return
            }

            const roomTask = tasks.find(task => task.name === room.name);

            if(!roomTask) {
                this.taskManager.scheduleTask(ManagerRoomTask, {
                    room: room
                })
            }
        })

        this.taskManager.init();

        this.taskManager.run();

        this.taskManager.visualize();
    }

    cleanupCreeps() {
        for (const name in Memory.creeps) {
            if (!(name in Game.creeps)) {
                console.log("Creep", name, "died!");
                delete Memory.creeps[name];
            }
          }
    }

    getRoomManager(roomName: string) {
        return this.rooms.find(mgr => mgr.name === roomName)
    }

    registerRoomManager(manager: ManagerRoomTask) {
        this.rooms.push(manager)
    }
}
