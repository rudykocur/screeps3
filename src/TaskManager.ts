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

export class TaskManager {
    private tasks: GenericTask[] = [];
    private taskMap: Record<string, GenericTask> = {};
    private running: boolean = false;
    private memory: Record<string, TaskRuntimeData>;

    constructor() {
        if(Memory.tasks === undefined) {
            console.log("INTIALIZING TASK MANAGER MEMORY");
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
                console.log('[TaskManager] WARNING! No implementation for', taskData.clazz)
            }
        })

        for(const task of this.tasks) {
            const taskId = task.getTaskId()
            const parentId = this.memory[taskId].parentTask

            if(parentId) {
                this.taskMap[parentId].registerChildTask(task)
            }
        }

        //console.log('Loaded', i, 'tasks from memory')
    }

    run() {
        let i = 0;

        while(this.tasks.length > 0) {
            const task = this.tasks.shift();
            if(task !== undefined) {

                const taskId = task.getTaskId();
                const taskData = this.memory[taskId];

                if(taskData.suspended) {
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
        }

        //console.log("Executed", i, "actions");
    }

    visualize() {
        for(const task of Object.values(this.taskMap)) {
            task.visualize();
        }
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

        console.log("[TaskManager] finished", task);
        delete this.memory[taskId];
    }

    delayTask(task: GenericTask, ticks: number) {
        this.memory[task.getTaskId()].sleepUntil = Game.time + ticks;
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

        console.log("Scheduled task", task);

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

    terminate(taskId: string) {
        const task = this.taskMap[taskId]
        this.handleFinshedTask(task)
    }

    toString() {
        return `[TaskManager]`
    }
}
