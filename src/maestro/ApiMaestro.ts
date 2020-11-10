import { ApiController } from 'controller/ApiController';
import { IApiAdapter } from '../adapter/IApiAdapter';
import { ApiContainer } from '../container/ApiContainer';
import { ApiError } from '../error/ApiError';
import { ApiException } from '../error/ApiException';
import { RequestFlowNotDefined } from '../error/exceptions/RequestFlowNotDefined';
import { IProxiedApiRoute } from '../proxy/IProxiedApiRoute';
import { IApiRouteRequest } from '../request/IApiRouteRequest';
import { ApiSendErrorFunction } from './ApiSendErrorFunction';
import { ApiSendResponseFunction } from './ApiSendResponseFunction';
import { RequestHandler } from './composition/RequestHandler';
import { IRequestPipe } from './composition/RequestPipe';
import * as Default from './default';
import { IApiMaestro } from './IApiMaestro';

export class ApiMaestro extends ApiContainer implements IApiMaestro {

	get baseURL() {
		return '';
	}

	public adapters: {
		[name: string]: IApiAdapter;
	} = {};

	protected requestPipes: IRequestPipe[] = [
		{
			name: 'property-validator',
			pipe: Default.SchemaValidator
		},
		{
			name: 'schema-enforcer',
			pipe: Default.SchemaEnforcer
		},
		{
			name: 'request-caster',
			pipe: Default.CastProperties
		}
	];


	public requestHandler: RequestHandler =
		Default.RequestHandler;

	/**
	 * Api Maestro
	 * -----------
	 * 
	 * Mostly responsible for wiring all the elements of the library
	 * Will connect all the adapters to the exposed API Endpoints
	 * enforcing policies and request/response flow inside the app
	 * 
	 */
	constructor() {
		super();
	}

	setRequestHandler(resolver: RequestHandler): void {
		this.requestHandler = resolver;
	}

	addAdapter(adapter: IApiAdapter) {
		this.adapters[adapter.name] = adapter;
	}

	use(...addToLyra: UseInMaestro[]) {
		addToLyra.forEach(use => {
			if (use instanceof ApiContainer) {
				this.addChildContainer(use);
				return;
			}

			if (use instanceof ApiController) {
				this.addController(use);
				return;
			}

		});
	}

	pipe(...pipes: IRequestPipe[]) {
		this.requestPipes = [...this.requestPipes, ...pipes];
		return this;
	}

	removePipe(name: string): boolean {
		let filteredPipes = this.requestPipes.filter(p => p.name !== name);
		let foundMatches = this.requestPipes.length !== filteredPipes.length;
		this.requestPipes = filteredPipes;
		return foundMatches;
	}

	allPipeNames(): string[] {
		return this.requestPipes.map(p => p.name);
	}

	allPipes() {
		return [...this.requestPipes];
	}

	public handle = async (
		route: IProxiedApiRoute,
		request: IApiRouteRequest,
		sendResponse: ApiSendResponseFunction,
		sendError: ApiSendErrorFunction
	) => {

		for (let pipe of this.requestPipes) {
			let canProceed = await pipe.pipe(route, request);
			if (canProceed !== true) {
				console.error('Failed to fulfill request!\n', pipe.name, ' returned the error: ', canProceed.message);
				sendError(canProceed);
				return;
			}
		}

		// Call API Endpoint
		let apiResponse = await this.requestHandler(route, request, sendResponse, sendError);
		if (apiResponse instanceof ApiError || apiResponse instanceof ApiException) {
			sendError(apiResponse);
			return;
		}

		// Any commands for Maestro ? 
		// TODO -- what will be exposed to ApiMaestro Command?

		sendResponse(apiResponse);
	};

	start() {

		if (typeof this.requestHandler !== "function") {
			throw new RequestFlowNotDefined(
				'API Maestro cannot fullfil request flow, one of its required pieces is missing! -> Request Resolver'
			);
		}

		for (let adapterName in this.adapters) {
			let adapter = this.adapters[adapterName];
			adapter.setRequestHandler(this.handle);
			adapter.addApiContainer(this);
			adapter.start();
		}

	}

}


export type UseInMaestro = ApiContainer | ApiController;