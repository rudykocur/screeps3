import { Logger } from "Logger";
import { RunResult } from "tasks/AbstractTask";
import { PersistentTask } from "tasks/PersistentTask";
import { TaskInitArgs, TaskMemory, TaskRuntimeData, TaskType } from "types";

export interface TaskWithActor {
    getActorId(): Id<Creep> | null | undefined
}

export type GenericTask = PersistentTask<TaskMemory, TaskInitArgs> | (PersistentTask<TaskMemory, TaskInitArgs> & TaskWithActor)

interface ScheduleTaskOptions {
    blocking?: boolean;
    parent?: GenericTask;
}

type LastRunCallback = () => void

export class TaskManager {
    private tasks: GenericTask[] = [];
    private taskMap: Record<string, GenericTask> = {};
    private running: boolean = false;
    private memory: Record<string, TaskRuntimeData>;
    private lastCallbacks: LastRunCallback[] = []

    private logger = new Logger('TaskManager')

    constructor() {
        if(Memory.tasks === undefined) {
            this.logger.important("INTIALIZING TASK MANAGER MEMORY");
            Memory.tasks = {}
        }

        this.memory = Memory.tasks;
    }

    preInit() {
        for(const task of this.tasks) {
            task.preInit();
        }
    }

    init() {
        for(const task of this.tasks) {
            task.init();
        }

        for(const task of this.tasks) {
            task.lateInit();
        }

        this.running = true;
    }

    loadPersistedTasks() {
        if(Memory.tasks === undefined) {
            return
        }

        let i = 0;

        Object.values(Memory.tasks).forEach(taskData => {
            const impl = PersistentTask.GetImplementations().find(impl => impl.name === taskData.clazz);

            if(impl) {
                const task = new impl(this, taskData.taskId);

                this.schedule(task);

                i++;
            }
            else {
                this.logger.error('[TaskManager] WARNING! No implementation for', taskData.clazz)
            }
        })

        for(const task of this.tasks) {
            const taskId = task.getTaskId()
            const parentId = this.memory[taskId].parentTask

            if(parentId) {
                this.taskMap[parentId].registerChildTask(task)
            }
        }
    }

    runLast(callback: LastRunCallback) {
        this.lastCallbacks.push(callback)
    }

    run() {
        let i = 0;

        while(this.tasks.length > 0) {
            const task = this.tasks.shift();
            if(task !== undefined) {

                const taskId = task.getTaskId();
                const taskData = this.memory[taskId];

                try {
                    if(!taskData) {
                        this.logger.error('Skipping task with no data', task)
                        continue
                    }

                    if(task.finised) {
                        this.logger.error('Skipping finished task', task)
                    }

                    if(task.finised || taskData.suspended) {
                        continue;
                    }

                    if(taskData.sleepUntil) {
                        if(taskData.sleepUntil > Game.time) {
                            continue
                        }
                        else {
                            delete taskData.sleepUntil
                        }
                    }

                    const result = task.run();

                    if(result === RunResult.DONE) {
                        this.handleFinshedTask(task)
                    }

                    i++;
                }
                catch(e) {
                    this.logger.critical('FAILED TO RUN TASK', task, '::', e, '::', e.stack)
                }
            }

            if(Game.cpu.getUsed() + 50 > Game.cpu.tickLimit) {
                this.logger.critical('TICK LIMIT REACHED', `used=${Game.cpu.getUsed()}, tickLimit=${Game.cpu.tickLimit} bucket=${Game.cpu.bucket}`)
                return
            }
        }

        for(const callback of this.lastCallbacks) {
            callback()
        }
    }

    visualize() {
        for(const task of Object.values(this.taskMap)) {
            task.visualize();
        }

        this.doVisualize()
    }

    handleFinshedTask(task: GenericTask) {
        const taskId = task.getTaskId();
        const taskData = this.memory[taskId];

        if(taskData.parentTask) {
            const parentData = this.memory[taskData.parentTask];
            const parentTask = this.taskMap[taskData.parentTask];

            parentData.subTasks = parentData.subTasks.filter(id => id !== taskId);
            if(parentData.subTasks.length === 0) {
                parentData.suspended = false;
                if(parentTask.finised) {
                    this.logger.error('<span style="background: olive; color: white">About to schedule finished parent task</span>', parentTask)
                }
                this.schedule(parentTask);
            }
            else {
                const firstSubTaskId = parentData.subTasks[0]
                const firstSubTaskData = this.memory[firstSubTaskId]
                const firstSubTask = this.taskMap[firstSubTaskId]
                firstSubTaskData.suspended = false;
                this.schedule(firstSubTask);
            }
        }

        this.logger.debug(`[TaskManager] ${taskId} finished`, task);

        this.finishSubtasks(task)

        if(taskData.reservations !== undefined) {
            Game.reservationManager.freeReservations(taskData.reservations)
        }

        delete this.memory[taskId];
    }

    finishSubtasks(task: GenericTask) {
        for(const child of task.getChildTasks()) {
            this.finishSubtasks(child)

            if(!child.finised) {
                this.logger.critical('Killing orphaned child', child)
            }

            const taskId = child.getTaskId();
            const taskData = this.memory[taskId];

            if(taskData && taskData.reservations !== undefined) {
                Game.reservationManager.freeReservations(taskData.reservations)
            }

            delete this.memory[taskId]
        }
    }

    delayTask(task: GenericTask, ticks: number) {
        this.memory[task.getTaskId()].sleepUntil = Game.time + ticks;
    }

    wakeUp(task: GenericTask) {
        delete this.memory[task.getTaskId()].sleepUntil;
    }

    scheduleTask<M extends TaskMemory, IA extends TaskInitArgs, T extends PersistentTask<M, IA>>(
        taskFactory: TaskType<T>,
        args: IA,
        options: ScheduleTaskOptions = {}
    ): T {
        let task = new taskFactory(this, undefined);
        task.create(args);

        if(options.parent) {
            const parentId = options.parent.getTaskId();
            const childId = task.getTaskId();

            if(options.blocking) {
                this.memory[parentId].subTasks.forEach(subTaskId => {
                    this.memory[subTaskId].suspended = true;
                })
            }

            this.memory[parentId].subTasks.push(childId);
            this.memory[childId].parentTask = parentId;

            options.parent.registerChildTask(task);

            if(options.blocking) {
                this.memory[parentId].suspended = true
            }
        }

        this.schedule(task);

        this.logger.debug("Scheduled task", task);

        return task;
    }

    private schedule(task: GenericTask) {
        this.tasks.push(task);
        this.taskMap[task.getTaskId()] = task;

        if(this.running) {
            task.preInit();
            task.init();
        }
    }

    getMemory<T extends TaskMemory>(taskId: string): T | null {
        if(Memory.tasks !== undefined) {
            let taskData = Memory.tasks[taskId]

            if(taskData !== undefined) {
                return (taskData.data as T);
            }
        }

        return null
    }

    initMemory(taskId: string, task: GenericTask, data: TaskMemory) {
        if(Memory.tasks !== undefined) {
            Memory.tasks[taskId] = {
                clazz: task.constructor.name,
                taskId: taskId,
                data: data,
                subTasks: [],
            }
        }
    }

    findTasks<T extends GenericTask>(
        clazz: TaskType<T>
    ): T[] {
        const x = Object.values(this.taskMap).filter(task => clazz.name === task.constructor.name);
        return (x as T[])
    }

    registerReservation(task: GenericTask, reservationId: string) {
        const taskId = task.getTaskId()

        const taskData = this.memory[taskId]

        if(taskData.reservations === undefined) {
            taskData.reservations = []
        }

        taskData.reservations.push(reservationId)
    }

    terminate(taskId: string) {
        const task = this.taskMap[taskId]
        this.handleFinshedTask(task)
    }

    doVisualize() {
        if(Memory.config?.visualizeTaskTree) {
            this.printTaskTree()
        }
    }

    finalize() {
        if(Game.cpu.getUsed() > Game.cpu.limit) {
            this.logger.warn('CPU Limit reached', `used=${Game.cpu.getUsed()}, limit=${Game.cpu.limit}, bucket=${Game.cpu.bucket}`)
        }
    }

    private printTaskTree() {
        const topTasks = Object.values(this.taskMap).filter(task => {
            const taskData = this.memory[task.getTaskId()]
            if(!taskData) {
                return false
            }

            return taskData.parentTask === undefined
        })

        const result: TaskTreeEntry[] = []

        for(const task of topTasks) {
            this.collectTaskData(task, '', result)
        }

        let topOffset = 0

        let room: Room
        if(Game.rooms.sim) {
            room = Game.rooms.sim
        } else {
            room = Object.values(Game.rooms)[0]
        }

        result.forEach((entry, index) => {
            room.visual.text(entry.text, 0, topOffset + index, {
                color: entry.color || 'white',
                stroke: 'black',
                align: "left",
            })
        })
    }

    private collectTaskData(task: GenericTask, indent: string, target: TaskTreeEntry[]) {
        const taskData = this.memory[task.getTaskId()]

        target.push({
            text: indent + task.toString(),
            color: taskData?.suspended ? 'gray' : undefined
        })
        for(const child of task.getChildTasks()) {
            this.collectTaskData(child, indent + '   ', target)
        }
    }

    toString() {
        return `[TaskManager]`
    }
}

interface TaskTreeEntry {
    text: string,
    color?: string,
}
