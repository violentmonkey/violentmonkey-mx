!function (root, factory) {
  if (typeof define === 'function' && define.amd)
    define([], factory);
  else if (typeof module === 'object' && module.exports)
    module.exports = factory();
  else
    root.Promise = factory();
}(typeof window !== 'undefined' ? window : this, function () {

  var PENDING = 'pending';
  var FULFILLED = 'fulfilled';
  var REJECTED = 'rejected';
  var slice = Array.prototype.slice;

  function syncCall(func, args) {
    func(args);
  }

  function partial() {
    var func = arguments[0];
    var args = slice.call(arguments, 1);
    return function () {
      var _args = args.concat(slice.call(arguments));
      return func.apply(this, _args);
    };
  }

  function resolvePromise(promise, data) {
    if (data instanceof Promise) {
      data.then(partial(resolvePromise, promise), partial(rejectPromise, promise));
    } else {
      promise.$$status = FULFILLED;
      promise.$$value = data;
      then(promise);
    }
  }
  function rejectPromise(promise, reason) {
    promise.$$status = REJECTED;
    promise.$$value = reason;
    then(promise);
  }
  function then(promise) {
    promise.$$then.forEach(function (func) {
      syncCall(func);
    });
    promise.$$then = [];
  }

  function Promise(resolver) {
    var _this = this;
    _this.$$status = PENDING;
    _this.$$value = null;
    _this.$$then = [];
    resolver(partial(resolvePromise, this), partial(rejectPromise, this));
  }

  Promise.prototype.then = function (okHandler, errHandler) {
    var _this = this;
    return new Promise(function (resolve, reject) {
      function callback() {
        var result;
        var resolved = _this.$$status === FULFILLED;
        var handler = resolved ? okHandler : errHandler;
        if (handler)
          try {
            result = handler(_this.$$value);
          } catch (e) {
            return reject(e);
          }
        else {
          result = _this.$$value;
          if (!resolved) return reject(result);
        }
        resolve(result);
      }
      if (_this.$$status === PENDING) _this.$$then.push(callback);
      else syncCall(callback);
    });
  };

  Promise.prototype.catch = function (errHandler) {
    return this.then(null, errHandler);
  };

  Promise.resolve = function (data) {
    return new Promise(function (resolve) {
      resolve(data);
    });
  };

  Promise.reject = function (data) {
    return new Promise(function (resolve, reject) {
      reject(data);
    });
  };

  Promise.all = function (promises) {
    return new Promise(function (resolve, reject) {
      function rejectAll(reason) {
        if (results) {
          results = null;
          reject(reason);
        }
      }
      function resolveOne(data, i) {
        if (results) {
          results[i] = data;
          pending --;
          check();
        }
      }
      function check() {
        results && !pending && resolve(results);
      }
      var results = [];
      var pending = promises.length;
      promises.forEach(function (promise, i) {
        if (promise instanceof Promise) {
          promise.then(function (data) {
            resolveOne(data, i);
          }, rejectAll);
        } else {
          resolveOne(promise, i);
        }
      });
      check();
    });
  };

  Promise.race = function (promises) {
    return new Promise(function (resolve, reject) {
      function resolveAll(data) {
        if (pending) {
          pending = false;
          resolve(data);
        }
      }
      function rejectAll(reason) {
        if (pending) {
          pending = false;
          reject(reason);
        }
      }
      var pending = true;
      promises.forEach(function (promise) {
        if (promise instanceof Promise) {
          promise.then(resolveAll, rejectAll);
        } else {
          resolveAll(promise);
        }
      });
    });
  };

  return Promise;

});
