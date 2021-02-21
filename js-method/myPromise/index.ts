export enum promiseStatus {
	PENDING = 'pending',
	REJECTED = 'rejected',
	FULFILLED = 'fulfilled'
}

export type promiseExecutor = (resolve: Function, reject?: Function) => void;

// 链式调用问题处理，2.3
function promiseResolutionProcedure(promise2: myPromise, x: any, resolve, reject) {
	if (promise2 === x) {
		throw TypeError('same promise here')
	}
	// 2.3.2 返回promise
	if (x instanceof myPromise) {

	}
	// 2.3.3 x 是对象或者函数
	// typeof null 是object
	if ((typeof x === 'object' && x !== null) || typeof x === 'function') {
		// 2.3.3.3.4.1 If resolvePromise or rejectPromise have been called, ignore it.
		let isCalled = false;
		// 2.3.3.1
		let then = x.then;
		// 2.3.3.3
		if (typeof then === 'function') {
			try {
				then.call(x, (y) => {
					isCalled = true;
					// 2.3.3.3.3 If both resolvePromise and rejectPromise are called, 
					// or multiple calls to the same argument are made, 
					// the first call takes precedence, and any further calls are ignored.
					if (isCalled) {
						return;
					}
					// 2.3.3.3.1
					promiseResolutionProcedure(promise2, y, resolve, reject);
				}, (reason) => {
						isCalled = true;
						// 2.3.3.3.3
						if (isCalled) {
							return;
						}
						// 2.3.3.3.2
						reject(reason);
				})
				//2.3.3.3.4 If calling then throws an exception e
			} catch (err) {
				if (isCalled) {
					return;
				}
				isCalled = true;
				reject(err);
			}
		}
	} else {
		//2.3.4 If x is not an object or function, fulfill promise with x.
		resolve(x);
	}

}

export default class myPromise {
	status: promiseStatus
	reason: any
	value: any
	resolveStack: any[]
	rejectStack: any[]

	constructor(executor: promiseExecutor) {
		this.status = promiseStatus.PENDING;
		this.reason = null;
		this.value = null;
		// 存储promise 链式调用结果
		this.resolveStack = [];
		this.rejectStack = [];

		const resolve = (value: any) => {
			if (this.status !== promiseStatus.PENDING) {
				return;
			}
			this.value = value;
			this.status = promiseStatus.FULFILLED;
			this.resolveStack.forEach(func => {
				func();
			})
		}
		
		const reject = (reason: any) => {
			if (this.status !== promiseStatus.PENDING) {
				return;
			}
			this.reason = reason;
			this.status = promiseStatus.REJECTED;
			this.rejectStack.forEach(func => {
				func();
			})
		}
		try {
			executor(resolve, reject);
		} catch (err) {
			reject(err)
		}
	}

	public then(onFulfilled, onRejected) {
		// 2.2.1 Both onFulfilled and onRejected are optional arguments: if not a function, igonre
		// 2.2.5 onFulfilled and onRejected must be called as functions (i.e. with no this value). [3.2]
		onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : (val) => val;
		onRejected = typeof onRejected === 'function' ? onRejected : (err) => { throw err };
		let promise2 = new myPromise((resolve, reject) => {
			// 2.2.4 onFulfilled or onRejected must not be called until the execution context stack contains only platform code
			// 下面的settimeout同理
				if (this.status === promiseStatus.FULFILLED) {
					try {
						// 2.2.7.1 onfufilled 内也返回了值， run the Promise Resolution Procedure
						setTimeout(() => {
							let x = onFulfilled(this.value);
							promiseResolutionProcedure(promise2, x, resolve, reject);
						}, 0);
					} catch (err) {
						reject(err);
					}
				}
				if (this.status === promiseStatus.REJECTED) {
					try {
						setTimeout(() => {
							let x = onRejected(this.reason);
							promiseResolutionProcedure(promise2, x, resolve, reject);
						}, 0);
					} catch (err) {
						// 2.2.7.2 If either onFulfilled or onRejected throws an exception e, 
						// promise2 must be rejected with e as the reason.
						reject(err);
					}
				}
			// 存储顺序，执行到resolve，reject的时候会调用顺序栈里的结果
			if (this.status === promiseStatus.PENDING) {
				// 2.2.6.1
				this.resolveStack.push(() => {
					setTimeout(() => {
						let x = onFulfilled(this.value);
						promiseResolutionProcedure(promise2, x, resolve, reject);
					}, 0)
				})
				// 2.2.6.2
				this.rejectStack.push(() => {
					setTimeout(() => {
						let x = onRejected(this.reason);
						promiseResolutionProcedure(promise2, x, resolve, reject);
					}, 0)
				})
			}
		})
		// 2.2.7 then must return a promise
		// 链式调用
		return promise2;
	}

	public static resolve(value) {
		return new myPromise(resolve => {
			resolve(value)
		})
	}

	public static reject(reason) {
		return new myPromise((resolve, reject) => {
			reject(reason)
		})
	}
}