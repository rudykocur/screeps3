import { TaskManager } from "TaskManager";
import { AbstractTask, RunResultType } from "./AbstractTask";
import { counter } from "GlobalCounter";
import { TaskInitArgs, TaskMemory, TaskType } from "types";

interface SpawnTaskArgs {
    block?: boolean
}

export abstract class PersistentTask<M extends TaskMemory, IA extends TaskInitArgs> implements AbstractTask {

    protected taskId: string;
    protected memory: M;
    protected childTasks: PersistentTask<TaskMemory, TaskInitArgs>[] = []
    // protected parentTask?: PersistentTask<TaskMemory, TaskInitArgs>

    constructor(protected taskManager: TaskManager, taskId: string | undefined) {
        if(taskId === undefined) {
            this.taskId = counter.generate();
        }
        else {
            this.taskId = taskId;
        }
    }

    registerChildTask(task: PersistentTask<TaskMemory, TaskInitArgs>) {
        this.childTasks.push(task)
    }

    removeChildTask(taskId: string) {
        this.childTasks = this.childTasks.filter(task => task.getTaskId() === taskId)
    }

    findTasks<T extends PersistentTask<TaskMemory, TaskInitArgs>>(
        clazz: TaskType<T>
    ): T[] {
        const x = this.childTasks.filter(task => this.isTaskType(clazz, task));
        return (x as T[])
    }

    isTaskType<M extends TaskMemory, IA extends TaskInitArgs, T extends PersistentTask<M, IA>>(
        clazz: TaskType<T>,
        task: PersistentTask<TaskMemory, TaskInitArgs>
    ): task is T {
        return clazz.name === task.constructor.name;
    }
    // setParent

    getTaskId() {
        return this.taskId;
    }

    create(args: IA) {
        let memory = this.taskManager.getMemory<M>(this.taskId)
        if(memory === null) {
            memory = this.initMemory(args)
            this.taskManager.initMemory(this.taskId, this, memory);
        }

        this.memory = memory
    }

    preInit() {
        let memory = this.taskManager.getMemory<M>(this.taskId)
        if(memory === null) {
            console.log("OMG FAILED TO LOAD FROM MEMORY", this.taskId);
            return
        }
        else {
            this.memory = memory;
        }

        this.doPreInit()
    }

    init(): void {
        this.doInit();
    }

    run(): RunResultType {
        if(!this.memory) {
            console.log("NO MEMORY !! Not running", this);
            return;
        }

        return this.doRun();
    }

    visualize() {
        this.doVisualize()
    }

    scheduleBlockingTask<M extends TaskMemory, IA extends TaskInitArgs>(
        taskFactory: TaskType<PersistentTask<M, IA>>,
        args: IA,
    ) {
        this.taskManager.scheduleTask(taskFactory, args, {
            blocking: true,
            parent: this,
        })
    }

    scheduleBackgroundTask<M extends TaskMemory, IA extends TaskInitArgs>(
        taskFactory: TaskType<PersistentTask<M, IA>>,
        args: IA,
    ) {
        this.taskManager.scheduleTask(taskFactory, args, {
            blocking: false,
            parent: this,
        })
    }

    sleep(ticks: number) {
        this.taskManager.delayTask(this, ticks)
    }

    abstract initMemory(args: IA): M
    doPreInit() {}
    abstract doInit(): void
    abstract doRun(): RunResultType
    doVisualize() {}
}


// add a registry of the type you expect
export namespace PersistentTask {
    type Constructor<T> = {
        new(...args: any[]): T;
        readonly prototype: T;
    }
    const implementations: Constructor<PersistentTask<TaskMemory, TaskInitArgs>>[] = [];
    export function GetImplementations(): Constructor<PersistentTask<TaskMemory, TaskInitArgs>>[] {
        return implementations;
    }
    export function register<T extends Constructor<PersistentTask<TaskMemory, TaskInitArgs>>>(ctor: T) {
        implementations.push(ctor);
        return ctor;
    }
}
