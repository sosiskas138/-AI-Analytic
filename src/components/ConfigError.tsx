import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 w-fit mx-auto">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Не настроен API URL</h1>
        <div className="text-left space-y-2 text-sm text-muted-foreground">
          <p>Для работы приложения необходимо создать файл <code className="bg-muted px-1 py-0.5 rounded">.env</code> в корне проекта со следующей переменной:</p>
          <pre className="bg-muted p-4 rounded text-xs overflow-auto">
{`VITE_API_URL=http://localhost:3001/api`}
          </pre>
          <p className="pt-2">Скопируйте файл <code className="bg-muted px-1 py-0.5 rounded">.env.example</code> в <code className="bg-muted px-1 py-0.5 rounded">.env</code> и укажите URL вашего API сервера.</p>
          <p>Убедитесь, что бэкенд сервер запущен и доступен по указанному адресу.</p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          className="mt-4"
        >
          Перезагрузить страницу
        </Button>
      </div>
    </div>
  );
}
