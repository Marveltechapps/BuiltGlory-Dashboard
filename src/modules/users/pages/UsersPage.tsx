import { useLocation } from 'react-router-dom';
import { UsersList } from '../components/UsersList';
import { USER_TAB } from '../constants';

/** /admin/users/{all|buyers|sellers} */
export function UsersPage() {
  const { pathname } = useLocation();
  return <UsersList tab={USER_TAB[pathname] || 'all'} />;
}
