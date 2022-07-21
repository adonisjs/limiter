The package has been configured successfully. The limiter configuration is stored inside the `config/limiter.ts` file.

Make sure to register the named middleware inside the `start/kernel.ts` file before applying rate limiting in your application.

```ts
Server.middleware.registerNamed({
  throttle: () => import('@adonisjs/limiter/build/throttle'),
})
```
