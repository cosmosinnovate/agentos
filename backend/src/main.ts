import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Swagger / OpenAPI docs
  const config = new DocumentBuilder()
    .setTitle('AgentOS Control Plane API')
    .setDescription('Enterprise AI Agent Control Plane — manage, deploy, and observe AI agents')
    .setVersion('1.0')
    .addTag('agents', 'Agent Registry & Lifecycle')
    .addTag('deployments', 'Deployment Manager')
    .addTag('tools', 'Tool Registry')
    .addTag('executions', 'Observability & Metrics')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 AgentOS Control Plane running on http://localhost:${port}`);
  console.log(`📚 API docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
