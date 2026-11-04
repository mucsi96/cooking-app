import { Button } from '@mucsi96/react-ui';

export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert"><p>{message}</p><Button variant="outlined" onPress={retry}>Újrapróbálás</Button></div>;
}
