/**
 * @seans-mfe/framework-angular/runtime — the Angular slot-registration sugar
 * (ADR-067, boundary layer 3). Imported by Angular provider MFEs / host code;
 * never by the neutral core or daemon. Separate entry from the build-time plugin
 * so loadFrameworkPlugin() in Node never pulls @angular/core.
 */
export { DeclaredSlotDirective } from './declared-slot.directive';
export type { SlotContractLike, ProvideSlotFn } from './declared-slot.directive';
